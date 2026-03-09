# Review Request Automator

A simple Node.js server that helps local businesses get more Google reviews. After you finish a job, trigger a review request to your customer via email or SMS. The system tracks who's been asked and sends follow-up reminders to people who haven't left a review yet.

## Why This Exists

Most happy customers won't leave a review unless you ask them. This tool makes asking easy and automatic. Set it up, connect it to your CRM or job management tool, and watch your Google reviews grow.

## Features

- **REST API** — Trigger review requests from any tool or workflow
- **Email + SMS** — Send via whichever channel works best
- **Customer tracking** — Keeps a record of who was asked and when
- **Follow-up reminders** — Automatically nudge customers who haven't responded
- **Customisable templates** — Edit the message templates to match your brand
- **Rate limiting** — Won't spam the same customer twice

## Setup

```bash
git clone https://github.com/Hand-On-Web-Ltd/review-request-automator.git
cd review-request-automator
npm install
cp .env.example .env
# Edit .env with your settings
npm start
```

## Environment Variables

See `.env.example` for all available settings. You'll need:
- Your Google Business review link
- SMTP credentials for email
- Twilio credentials for SMS (optional)

## API Endpoints

### Send a review request
```
POST /api/request
Content-Type: application/json

{
  "customerName": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+447700900000",
  "channel": "email",
  "jobReference": "JOB-1234"
}
```

### Check request status
```
GET /api/requests
GET /api/requests/:id
```

### Trigger follow-ups manually
```
POST /api/follow-up
```

## Templates

Edit the templates in the `templates/` folder to customise your messages:
- `email-template.md` — HTML email body
- `sms-template.md` — Short SMS text

## Connecting to Your Workflow

Works great with:
- **n8n** — Use an HTTP Request node to call the API after a job completes
- **Zapier** — Webhook trigger to the `/api/request` endpoint
- **Manual** — Just use curl or Postman

## About Hand On Web
We build AI chatbots, voice agents, and automation tools for businesses.
- 🌐 [handonweb.com](https://www.handonweb.com)
- 📧 outreach@handonweb.com
- 📍 Chester, UK

## Licence
MIT
