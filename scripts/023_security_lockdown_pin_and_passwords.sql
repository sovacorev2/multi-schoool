-- SECURITY FIX - run this in the Supabase SQL Editor AFTER the code changes
-- (lib/supabase/server.ts using the service-role key, plus every rewired
-- login/admin-password/pin-generation flow) have been deployed to
-- production. Running it before that deploy will break real logins - the
-- app's own server-side code needs to already be privileged, or it hits the
-- exact same locks a stranger would.
--
-- Also set the SUPER_ADMIN_PASSWORD environment variable (both locally in
-- .env.local and in your hosting provider's env vars) to a new password
-- before deploying - the old one ('shuletech2024') was hardcoded in the
-- client bundle and must be treated as already public.
--
-- What this fixes, and why each table needed a different technique:
--   1. schools.admin_password - moved to its own table entirely, not just
--      locked down in place, because `schools` is read directly from the
--      browser across dozens of legitimate call sites (school name, logo,
--      feature flags, etc.) AND is realtime-subscribed from the super-admin
--      page. A column-level REVOKE wouldn't reliably stop Realtime's
--      postgres_changes payloads (which broadcast full rows) from still
--      including it, so the password needed a table nothing else touches.
--   2. teacher_accounts.pin / .password - column-level REVOKE, not table
--      RLS, because 12+ legitimate admin/timetable pages need to keep
--      reading everything else in this table (names, emails, assignments)
--      directly from the browser. Only these two credential columns are
--      restricted.
--   3. payment_transactions - real M-Pesa/NCBA phone numbers and
--      transaction records, with no legitimate browser-side need left after
--      the super-admin payment-history view moved to a server action. Full
--      RLS lockdown (re-enabling what scripts/007 had explicitly disabled).

-- ============================================================
-- 1. School admin/"welcome" password
-- ============================================================
CREATE TABLE IF NOT EXISTS school_credentials (
  school_id uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  admin_password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Carry over every school's existing password before the column disappears.
INSERT INTO school_credentials (school_id, admin_password)
SELECT id, admin_password FROM schools
WHERE admin_password IS NOT NULL
ON CONFLICT (school_id) DO NOTHING;

ALTER TABLE school_credentials ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated = fully closed to both. The
-- service-role key Supabase gave this project bypasses RLS entirely
-- regardless of policies, so the app's own server actions are unaffected.
REVOKE ALL ON school_credentials FROM anon, authenticated;

-- Verify school_credentials has one row per school with a password before
-- running this - if the count below doesn't match what you expect, stop and
-- investigate rather than dropping the original column.
--   SELECT count(*) FROM school_credentials;
--   SELECT count(*) FROM schools WHERE admin_password IS NOT NULL;
ALTER TABLE schools DROP COLUMN IF EXISTS admin_password;

-- ============================================================
-- 2. Teacher PIN column (teacher_accounts has no separate password
--    column in this database - pin is the only credential here)
-- ============================================================
REVOKE SELECT (pin) ON teacher_accounts FROM anon, authenticated;

-- ============================================================
-- 3. Payment transactions
-- ============================================================
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_transactions FROM anon, authenticated;

-- ============================================================
-- Verification queries - run these after, expect ZERO rows / an error
-- back from each (confirms the anon key can no longer read them):
--
--   set role anon;
--   select pin from teacher_accounts limit 1;              -- should error
--   select * from payment_transactions limit 1;             -- should error
--   select * from school_credentials limit 1;               -- should error
--   select admin_password from schools limit 1;             -- column gone
--   reset role;
-- ============================================================
