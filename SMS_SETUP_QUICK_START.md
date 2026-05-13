# 🚀 SMS Setup - Quick Start Guide

## Choose Your Setup Method

### Option 1: Automated Setup (Recommended)

#### Mac/Linux Users:
```bash
bash setup-sms.sh
```

#### Windows Users:
```cmd
setup-sms.bat
```

The script will:
- ✓ Ask for your Africa's Talking credentials
- ✓ Create/update `.env.local` file
- ✓ Install dependencies
- ✓ Verify everything is configured

---

### Option 2: Manual Setup

#### Step 1: Get Your API Credentials
1. Go to https://account.africastalking.com
2. Login to your ShuleTech team
3. Go to **Settings → API Key**
4. Copy your API Key, Username, and Sender ID

#### Step 2: Create `.env.local`
Create a file named `.env.local` in your project root:

```
AFRICAS_TALKING_API_KEY=your_api_key_here
AFRICAS_TALKING_USERNAME=shuletech
AFRICAS_TALKING_SENDER_ID=SHULETECH
```

#### Step 3: Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

#### Step 4: Start Development Server
```bash
npm run dev
```

---

## Testing Your Setup

### 1. Access Super Admin SMS Dashboard
Go to: `http://localhost:3000/super-admin/sms-management`

Password: `shuletech`

### 2. Check Balance
You should see your Africa's Talking balance (KES)

### 3. Test Buying SMS
- Click "Buy SMS" tab
- Enter 100 SMS
- Click "Buy SMS Now"
- Balance should update

### 4. Enable SMS for Schools
- Go to Super Admin main dashboard
- Find a school
- Toggle SMS feature ON
- School admins will now see SMS menu

---

## Deploying to Vercel

After local testing, deploy to Vercel:

### 1. Go to Vercel Project Settings
https://vercel.com/dashboard → Your Project → Settings

### 2. Add Environment Variables
Add these three variables:
```
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=shuletech
AFRICAS_TALKING_SENDER_ID=SHULETECH
```

### 3. Redeploy
Go to **Deployments** → Click latest → Click **...** → **Redeploy**

Wait 2-3 minutes for deployment to complete.

### 4. Test Production
Go to: `https://your-app.vercel.app/super-admin/sms-management`

---

## Troubleshooting

### Balance Shows 0 or Error
- ✓ Check API Key is correct (copy/paste exactly)
- ✓ Verify you're using LIVE credentials (not sandbox)
- ✓ Make sure `.env.local` is saved
- ✓ Restart development server (`npm run dev`)

### SMS Feature Not Showing for Schools
- ✓ Check SMS is enabled for school in Super Admin
- ✓ Refresh school admin page
- ✓ Clear browser cache

### Can't Run Setup Script
- **Mac/Linux:** `bash setup-sms.sh` (make sure script has execute permission)
- **Windows:** Double-click `setup-sms.bat`
- **Manual:** Follow Option 2 above

---

## What's Next?

1. ✅ Configure SMS bundles (100, 500, 1000 SMS packages)
2. ✅ Enable SMS for your schools
3. ✅ Schools request SMS bundles
4. ✅ You approve requests
5. ✅ Schools send SMS to parents/students

---

## Support

- Africa's Talking: https://africastalking.com/support
- Full Setup Guide: See `docs/SMS_PRODUCTION_SETUP.md`

**Everything is ready. Your SMS system is now live!** 🎉
