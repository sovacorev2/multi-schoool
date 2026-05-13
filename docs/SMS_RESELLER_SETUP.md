# SMS Reseller System Setup Guide

## Overview
This is a **complete SMS reseller system** for schools using Africa's Talking API. You manage a single Africa's Talking account and resell SMS bundles to schools.

## Architecture

```
You (Super Admin)
    ↓
    └─→ Africa's Talking Account (Single)
            ↓
            └─→ Multiple Schools
                    ├─→ School 1 (100 SMS balance)
                    ├─→ School 2 (500 SMS balance)
                    └─→ School 3 (1000 SMS balance)
```

## Setup Steps

### 1. Africa's Talking Account Setup

1. Go to https://africastalking.com/
2. Create account and get API credentials:
   - **API Key**: Your authentication key
   - **Username**: Your account username
   - **Phone Number** (optional): Sender ID for SMS (e.g., "SHULECH")

### 2. Environment Variables (Add to Vercel)

```env
AFRICAS_TALKING_API_KEY=<your-api-key>
AFRICAS_TALKING_USERNAME=<your-username>
AFRICAS_TALKING_SENDER_ID=SHULECH
```

### 3. Database Setup

Run this migration in Supabase SQL Editor:

```sql
-- See: scripts/migrations/sms-reseller-system.sql
```

This creates:
- `sms_bundles` - Bundle packages (100, 500, 1000 SMS)
- `school_sms_credits` - Per-school balance tracking
- `sms_transactions` - Purchase requests and approvals
- `sms_usage_logs` - SMS sent history

### 4. SMS Bundle Configuration

As Super Admin, configure bundle pricing. Example:

| Bundle | SMS Count | Price (KES) |
|--------|-----------|------------|
| Small  | 100       | 500        |
| Medium | 500       | 2,000      |
| Large  | 1000      | 3,500      |

**Cost breakdown:**
- Africa's Talking rate: ~KES 5-10 per SMS
- Your markup: 100-200%
- Schools pay you; you pay Africa's Talking

## Features

### Super Admin Dashboard
- ✅ View all SMS bundles and set pricing
- ✅ See all schools' SMS balances
- ✅ Approve/reject purchase requests
- ✅ View SMS transaction history
- ✅ Monitor SMS usage logs
- ✅ Toggle SMS feature per school

### School Admin Dashboard
- ✅ View current SMS balance
- ✅ Request to buy SMS bundles
- ✅ View purchase history
- ✅ Send bulk SMS (auto-deducts from balance)
- ✅ Monitor SMS usage

## API Endpoints

### Send SMS
```
POST /api/messaging/send-sms-africas-talking

Body:
{
  "schoolId": "uuid",
  "recipients": ["+254712345678", "0712345678"],
  "message": "Your exam results..."
}

Response:
{
  "success": true,
  "recipientCount": 1,
  "totalSmsUsed": 1,
  "creditsRemaining": 99
}
```

**Error Responses:**
- `402 Insufficient SMS credits` - School doesn't have enough balance
- `400 Missing required fields` - Invalid request
- `500 Africa's Talking error` - API error

### Phone Number Formats Supported
- `+254712345678` (International format)
- `0712345678` (Kenya format - auto-converted)
- `254712345678` (Without + symbol)

## How It Works

### 1. School Requests SMS Bundle
```
School Admin → "Buy 500 SMS for KES 2,000"
↓
Marked as "pending" in sms_transactions table
```

### 2. Super Admin Approves
```
Super Admin → Reviews request → Clicks "Approve"
↓
✅ School balance += 500 SMS
✅ Transaction status = "completed"
✅ Super Admin paid from Africa's Talking balance
```

### 3. School Sends SMS
```
School Admin → Composes message → Sends to recipients
↓
✅ Message sent via Africa's Talking
✅ SMS credits deducted from school balance
✅ Usage logged in sms_usage_logs
```

## Cost Model Example

**Your Setup:**
- Africa's Talking rate: KES 7 per SMS
- Your markup: 100%

**100 SMS Bundle:**
- Your cost: 100 × KES 7 = KES 700
- School pays: KES 1,000
- Your profit: KES 300

**500 SMS Bundle:**
- Your cost: 500 × KES 7 = KES 3,500
- School pays: KES 5,000
- Your profit: KES 1,500

**1000 SMS Bundle:**
- Your cost: 1,000 × KES 7 = KES 7,000
- School pays: KES 10,000
- Your profit: KES 3,000

## Important Notes

1. **Message Length**: SMS counts as follows:
   - 160 characters = 1 SMS
   - 153 characters (concatenated) = 1 SMS per segment
   - System automatically calculates needed credits

2. **Phone Numbers**: All numbers converted to +254 format for Africa's Talking API

3. **Sender ID**: Messages appear to come from "SHULECH" (your brand)

4. **Audit Trail**: Every transaction logged for transparency

5. **RLS Security**: Schools can only see their own data; Super Admin sees everything

## Troubleshooting

**"Insufficient SMS credits"**
- School balance is too low
- Request larger bundle and wait for approval

**"Africa's Talking API error"**
- Check API credentials in Vercel environment
- Verify API key is active in Africa's Talking dashboard
- Check that your account has SMS credits

**"Phone number format error"**
- Ensure numbers are valid Kenya phone numbers
- Format: +254712345678 or 0712345678

## Monitoring

View all SMS activities:

```sql
-- School's SMS balance
select * from school_sms_credits where school_id = 'uuid';

-- All transactions
select * from sms_transactions order by created_at desc;

-- SMS usage logs
select * from sms_usage_logs order by sent_at desc;

-- Pending approvals
select * from sms_transactions where status = 'pending';
```

## Next Steps

1. Set up Africa's Talking account
2. Add credentials to Vercel
3. Run database migration
4. Configure SMS bundles in Super Admin
5. Enable SMS feature for schools
6. Test with bulk SMS from admin
