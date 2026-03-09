require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// In-memory store (swap for a database in production)
const requests = new Map();

const REVIEW_URL = process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/YOUR_REVIEW_LINK/review';
const PORT = process.env.PORT || 3000;
const FOLLOW_UP_DAYS = parseInt(process.env.FOLLOW_UP_DAYS || '3', 10);

// Email transporter
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Load templates
const fs = require('fs');
const path = require('path');

function loadTemplate(name) {
  try {
    return fs.readFileSync(path.join(__dirname, 'templates', name), 'utf8');
  } catch (e) {
    return null;
  }
}

function fillTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

// Send review request
app.post('/api/request', async (req, res) => {
  const { customerName, email, phone, channel, jobReference } = req.body;

  if (!customerName || (!email && !phone)) {
    return res.status(400).json({ error: 'customerName and either email or phone are required' });
  }

  // Check if already requested recently
  const existing = [...requests.values()].find(
    r => (r.email === email || r.phone === phone) && Date.now() - r.createdAt < 7 * 24 * 60 * 60 * 1000
  );
  if (existing) {
    return res.status(409).json({ error: 'Review already requested for this customer recently', requestId: existing.id });
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    customerName,
    email: email || null,
    phone: phone || null,
    channel: channel || 'email',
    jobReference: jobReference || null,
    status: 'pending',
    createdAt: Date.now(),
    followUpSent: false,
  };

  const vars = {
    customerName,
    reviewUrl: REVIEW_URL,
    businessName: process.env.BUSINESS_NAME || 'Our Team',
  };

  try {
    if (record.channel === 'email' && transporter && email) {
      const emailTemplate = loadTemplate('email-template.md') || 'Hi {{customerName}}, we\'d love your feedback! Leave us a review: {{reviewUrl}}';
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `How was your experience, ${customerName}?`,
        html: fillTemplate(emailTemplate, vars),
      });
      record.status = 'sent';
    } else if (record.channel === 'sms' && phone) {
      // SMS sending would go here (Twilio, etc.)
      // For now, just log it
      const smsTemplate = loadTemplate('sms-template.md') || 'Hi {{customerName}}! How was your experience? Leave us a quick review: {{reviewUrl}}';
      console.log(`SMS to ${phone}: ${fillTemplate(smsTemplate, vars)}`);
      record.status = 'sent';
    } else {
      record.status = 'queued';
    }
  } catch (err) {
    console.error('Failed to send:', err.message);
    record.status = 'failed';
  }

  requests.set(id, record);
  res.status(201).json(record);
});

// List all requests
app.get('/api/requests', (req, res) => {
  const all = [...requests.values()].sort((a, b) => b.createdAt - a.createdAt);
  res.json(all);
});

// Get single request
app.get('/api/requests/:id', (req, res) => {
  const record = requests.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json(record);
});

// Trigger follow-ups
app.post('/api/follow-up', async (req, res) => {
  const cutoff = Date.now() - FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;
  const due = [...requests.values()].filter(
    r => r.status === 'sent' && !r.followUpSent && r.createdAt < cutoff
  );

  let sent = 0;
  for (const record of due) {
    try {
      if (record.channel === 'email' && transporter && record.email) {
        const vars = {
          customerName: record.customerName,
          reviewUrl: REVIEW_URL,
          businessName: process.env.BUSINESS_NAME || 'Our Team',
        };
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: record.email,
          subject: `Quick reminder, ${record.customerName}`,
          html: `<p>Hi ${record.customerName},</p><p>Just a quick follow-up — if you have a moment, we'd really appreciate a Google review.</p><p><a href="${REVIEW_URL}">Leave a review here</a></p><p>Thanks!</p>`,
        });
      }
      record.followUpSent = true;
      sent++;
    } catch (err) {
      console.error(`Follow-up failed for ${record.id}:`, err.message);
    }
  }

  res.json({ followUpsSent: sent, totalDue: due.length });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', requests: requests.size }));

app.listen(PORT, () => {
  console.log(`Review Request Automator running on port ${PORT}`);
});
