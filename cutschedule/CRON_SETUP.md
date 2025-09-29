# Automated Reminder System Setup

This document explains how to set up automated SMS reminders for the CutSchedule application.

## Overview

The system sends three types of automated messages:
1. **1-day reminders**: Sent 24 hours before appointments
2. **1-hour reminders**: Sent 1 hour before appointments
3. **Re-engagement messages**: Sent to customers 2-3 weeks after their last appointment

## Cron Endpoint

**URL**: `https://your-domain.com/api/cron/reminders`
**Method**: GET or POST
**Authentication**: Bearer token (set `CRON_SECRET` environment variable)

## Environment Variables

Add these to your `.env` file:

```bash
# Required for cron authentication
CRON_SECRET=your-secure-random-secret-here

# Twilio credentials (already configured)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
BARBER_PHONE=your-twilio-phone-number

# Database connection (already configured)
DATABASE_URL=your-database-url
```

## Setting Up Cron Jobs

### Option 1: Using Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9,12,15,18 * * *"
    }
  ]
}
```

This runs the reminder system at 9 AM, 12 PM, 3 PM, and 6 PM daily.

### Option 2: Using cron-job.org (External service)

1. Sign up at https://cron-job.org
2. Create a new cron job with these settings:
   - **URL**: `https://your-domain.com/api/cron/reminders`
   - **Schedule**: `0 */3 * * *` (every 3 hours)
   - **HTTP Method**: GET
   - **Headers**:
     ```
     Authorization: Bearer your-cron-secret
     Content-Type: application/json
     ```

### Option 3: Using GitHub Actions

Create `.github/workflows/reminders.yml`:

```yaml
name: Send Automated Reminders

on:
  schedule:
    - cron: '0 */3 * * *'  # Every 3 hours

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call reminder endpoint
        run: |
          curl -X GET "https://your-domain.com/api/cron/reminders" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

Add `CRON_SECRET` to your GitHub repository secrets.

### Option 4: Using a VPS/Server with crontab

On your server, edit the crontab:

```bash
crontab -e
```

Add this line:

```bash
0 */3 * * * curl -X GET "https://your-domain.com/api/cron/reminders" -H "Authorization: Bearer your-cron-secret" >/dev/null 2>&1
```

## Testing the Cron Job

Test the endpoint manually:

```bash
curl -X GET "http://localhost:3001/api/cron/reminders" \
  -H "Authorization: Bearer your-cron-secret" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "results": {
    "oneDayReminders": 2,
    "oneHourReminders": 1,
    "reEngagementMessages": 0,
    "errors": []
  }
}
```

## How It Works

### 1-Day Reminders
- Checks for appointments scheduled for tomorrow
- Sends reminder SMS only once per appointment
- Uses `reminder_1day` message template

### 1-Hour Reminders
- Checks for appointments starting in approximately 1 hour (±15 minutes)
- Sends reminder SMS only once per appointment
- Uses `reminder_1hour` message template

### Re-engagement Messages
- **2-week messages**: Sent to customers whose last appointment was exactly 2 weeks ago
- **3-week messages**: Sent to customers whose last appointment was exactly 3 weeks ago
- Only sent if customer hasn't booked another appointment
- Only sent once per customer per time period

## Message Templates

Templates are defined in `/lib/sms.ts`:

- **confirmation**: Sent when appointment is booked
- **reminder_1day**: "Hi {clientName}! Reminder: You have a haircut appointment tomorrow..."
- **reminder_1hour**: "Hi {clientName}! Your haircut appointment with Neil starts in 1 hour..."
- **reschedule_2weeks**: "Hi {clientName}! It's been 2 weeks since your last haircut..."
- **reschedule_3weeks**: "Hi {clientName}! Ready for your next haircut?..."
- **cancellation**: Sent when appointment is cancelled

## Monitoring

- All SMS sending is logged in the `SMSLog` table
- Check the cron endpoint response for success/error counts
- Monitor your Twilio console for SMS delivery status
- Review server logs for any errors

## Recommended Schedule

For optimal user experience:
- **Every 3 hours during business hours**: 9 AM, 12 PM, 3 PM, 6 PM
- **Less frequent during off-hours**: Once at 9 AM and 6 PM
- **Avoid late night**: Don't send between 9 PM and 8 AM

## Troubleshooting

### Common Issues:

1. **401 Unauthorized**: Check `CRON_SECRET` environment variable
2. **SMS not sending**: Verify Twilio credentials and phone number format
3. **Duplicate messages**: The system prevents duplicates, but check SMS logs
4. **No messages sent**: Verify appointments exist and are in correct status

### Debug Mode:

Set `NODE_ENV=development` to see detailed console logs during cron execution.