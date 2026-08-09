-- Fixes the school lock/unlock feature being unable to actually lock a school.
--
-- The `schools` table has Row Level Security enabled with a policy that only
-- allows writes where is_active = true (verified directly: inserting or
-- updating a row with is_active: false is rejected with "new row violates
-- row-level security policy for table schools", while is_active: true or
-- omitted succeeds). That silently blocks:
--   - the super-admin "Force Locked" button (schools.is_active -> false)
--   - the daily cron job that auto-locks schools past their subscription
--     expiry (/api/cron/lock-expired-schools), since it also runs through
--     the anon key with no service-role bypass
--
-- Every other table in this app (schools included, for every OTHER field) is
-- read and written directly from the browser/server via the publishable/anon
-- key with no Supabase Auth session, so RLS should be off here too, matching
-- scripts/004 and scripts/006's fix for the same pattern.
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;

-- payment_transactions (added in scripts/005) has the identical problem: RLS
-- enabled with no permissive policy, so every insert - recording an STK Push
-- prompt or a webhook-confirmed payment - is silently rejected. Same fix.
ALTER TABLE payment_transactions DISABLE ROW LEVEL SECURITY;
