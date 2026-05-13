# SMS Integration Setup Guide

## Twilio Configuration

### 1. Get Twilio Account
- Sign up at https://www.twilio.com/
- Get your Account SID and Auth Token from the Twilio Console
- Get a Twilio phone number (SMS-enabled)

### 2. Set Environment Variables
Add these to your Vercel project settings or `.env.project`:

```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Database Setup
Run the SMS logs migration:

```sql
-- Execute scripts/migrations/add-sms-logs-table.sql in your Supabase console
```

## How SMS Messaging Works

### API Endpoint: `/api/messaging/send-sms`

**POST Request:**
```json
{
  "schoolId": "school-uuid",
  "messageType": "bulk",
  "recipients": [
    {
      "name": "John Doe",
      "phone": "254712345678"
    },
    {
      "name": "Jane Smith",
      "phone": "0712345679"
    }
  ],
  "message": "Your exam results are ready. Please visit the portal."
}
```

**Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "stats": {
    "total": 2,
    "sent": 2,
    "failed": 0
  },
  "results": [
    {
      "recipient": "John Doe",
      "phone": "+254712345678",
      "status": "sent",
      "messageId": "SM123456789"
    }
  ]
}
```

### Phone Number Formats Supported
- International: `+254712345678`
- Kenya 0-prefix: `0712345678`
- Plain number: `254712345678`

All formats are automatically normalized to international format.

## Features

✅ Bulk SMS sending to multiple recipients  
✅ Automatic phone number normalization  
✅ Twilio message tracking (SID)  
✅ Audit trail in SMS logs table  
✅ Separate from WhatsApp feature  
✅ Error handling and retry logic  

## Integration Points

1. **Admin Dashboard** - Create UI in `/admin/update-logos` or similar
2. **Report Cards** - SMS notification when ready
3. **Exam Results** - Send SMS to parents/guardians
4. **Notifications** - System notifications via SMS

## Cost Considerations

Twilio charges per SMS:
- USD $0.0075 per SMS (typical rate)
- Varies by destination country
- Monitor usage in Twilio console
