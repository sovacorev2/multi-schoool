# Supabase SMS Tables Setup

Your SMS system needs these database tables to work. Follow these steps to create them.

## Step 1: Go to Supabase

1. Go to https://supabase.com/dashboard
2. Click your project (shuletech-exam-system or similar)
3. Click **SQL Editor** in the left sidebar

## Step 2: Create the Tables

1. Click **New Query**
2. Copy the SQL from `scripts/create-sms-tables.sql`
3. Paste it into the SQL editor
4. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

The tables will be created automatically:
- `sms_bundles` - SMS packages (100, 500, 1000 SMS)
- `school_sms_credits` - Each school's balance
- `sms_transactions` - Purchase requests from schools
- `sms_usage_logs` - Track every SMS sent

## Step 3: Verify Tables Exist

1. In Supabase, click **Table Editor** 
2. You should see these new tables listed:
   - sms_bundles
   - school_sms_credits
   - sms_transactions
   - sms_usage_logs

## Step 4: Test

1. Go back to your app
2. Refresh `/super-admin/sms-management`
3. Your balance should now load from Africa's Talking

## If Tables Already Exist

If you see an error about tables already existing, that's fine - the SQL has `IF NOT EXISTS` clauses to prevent duplicates.

## Need Help?

- Check Supabase logs: Dashboard → Logs → Database
- Verify you're in the correct Supabase project
- Make sure you copied the entire SQL script
