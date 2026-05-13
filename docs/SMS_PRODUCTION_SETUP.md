# SMS Production Setup Guide - Africa's Talking

Complete guide to set up real SMS communications with Africa's Talking for Shuletech exam system.

## Prerequisites

- Africa's Talking account (https://africastalking.com)
- Vercel project access
- Super Admin credentials for your system

---

## Step 1: Get Africa's Talking Credentials

### 1.1 Access Your Account
1. Go to https://account.africastalking.com
2. Login with your credentials
3. Click on "ShuleTech" team (or your team name)

### 1.2 Get API Key
1. Go to **Settings → API** (in your team dashboard)
2. Copy your **API Key**
3. Note your **Username** (usually your email or team name)

### 1.3 Get Sender ID (Optional but Recommended)
1. Go to **Settings → Senders**
2. Create or use existing sender (e.g., "SHULETECH")
3. This is what will appear as SMS sender name

---

## Step 2: Add Credentials to Vercel

### 2.1 Go to Vercel Settings
1. Go to https://vercel.com/dashboard
2. Click your project (v0-exam-system)
3. Click **Settings → Environment Variables**

### 2.2 Add Three Variables

Add these three environment variables:

```
AFRICAS_TALKING_API_KEY = <your-api-key-from-step-1.2>
AFRICAS_TALKING_USERNAME = <your-username-from-step-1.2>
AFRICAS_TALKING_SENDER_ID = SHULETECH
```

**Example:**
```
AFRICAS_TALKING_API_KEY = atsk_1986f85892493c4afac7d78de7591dab703334812dff9362badefc6f4ff10d1084795b8b
AFRICAS_TALKING_USERNAME = iscolevv@gmail.com
AFRICAS_TALKING_SENDER_ID = SHULETECH
```

### 2.3 Redeploy Your Project
After adding variables:
1. Go to your Vercel project
2. Click **Deployments**
3. Click the most recent deployment
4. Click the **...** menu → **Redeploy**
5. Wait for deployment to complete

---

## Step 3: Configure SMS Bundles

### 3.1 Access Super Admin SMS Management
1. Go to your app → `/super-admin/sms-management`
2. Enter password: `shuletech`
3. You should see your Africa's Talking balance

### 3.2 Buy SMS Credits
1. Click **"Buy SMS"** tab
2. Enter number of SMS (e.g., 1000)
3. See cost estimate
4. Click **"Buy SMS Now"**
5. Your balance will update in real-time

### 3.3 Configure SMS Bundles for Schools
The bundles are already configured, but you can customize:
1. Go to Supabase → `sms_bundles` table
2. Add or edit bundle packages:
   - 100 SMS @ KES 500
   - 500 SMS @ KES 2000
   - 1000 SMS @ KES 3500

---

## Step 4: Enable SMS for Schools

### 4.1 Super Admin Dashboard
1. Go to `/super-admin/sms-management`
2. Login with password: `shuletech`
3. In "School Credits" tab, you'll see all schools

### 4.2 Toggle SMS Feature
1. Find the school (e.g., Amagoro Comprehensive)
2. Toggle "SMS" feature ON
3. School admins will now see SMS in their menu

---

## Step 5: Schools Request and Use SMS

### 5.1 School Admin Requests SMS
1. School admin logs in → **SMS** menu (if enabled)
2. Select SMS bundle (e.g., 1000 SMS @ KES 3500)
3. Click **"Request Bundle"**
4. Request appears in Super Admin dashboard

### 5.2 Super Admin Approves Request
1. Go to `/super-admin/sms-management` → **Transactions** tab
2. See pending request from school
3. Click **Approve** → SMS credits auto-added to school

### 5.3 School Uses SMS
1. School sees updated balance in SMS dashboard
2. They can now send SMS to parents/students
3. Balance decreases with each SMS sent

---

## Troubleshooting

### Balance Shows 0
- **Check:** API key is correct (copy/paste exactly)
- **Check:** Credentials are for LIVE account, not SANDBOX
- **Check:** Vercel deployment was redeployed after adding variables
- **Try:** Refresh page after 2-3 minutes

### SMS Fails to Send
- **Check:** School has enough SMS balance
- **Check:** Phone numbers are valid Kenya format (+254 or 07XX)
- **Check:** Message is not empty
- **Try:** Test with single phone number first

### SMS Feature Not Showing in School
- **Check:** Feature is toggled ON in Super Admin
- **Check:** Refresh school admin page
- **Check:** Clear browser cache

### School Can't Request Bundles
- **Check:** SMS bundles are created in database
- **Check:** School has SMS feature enabled
- **Try:** Refresh page and try again

---

## Testing

### Test Purchase Flow
1. Buy 100 SMS from Super Admin
2. Check balance updated
3. Create small bundle (10 SMS @ KES 100)
4. Request as school
5. Approve in Super Admin
6. Send 1 test SMS

### Real Cost Example
```
Buy 1000 SMS from Africa's Talking: KES 500 (example)
Sell 100 SMS bundle to school: KES 600
Sell 500 SMS bundle to school: KES 2800
Sell 1000 SMS bundle to school: KES 5000

Your Profit: You keep the difference
```

---

## API Endpoints

Your system uses these production endpoints:

- `https://api.africastalking.com/version1/user` - Get balance
- `https://api.africastalking.com/version1/messaging` - Send SMS

No sandbox - this is LIVE!

---

## Support

- Africa's Talking Support: https://africastalking.com/support
- Shuletech Docs: Check `/docs` folder

---

**You are now ready to use SMS communications in production!**
