-- SECURITY FIX (round 2) - run this ONLY after the corresponding code
-- deploy is confirmed live (every client read of teacher_accounts/classes
-- migrated to the _public views below). Running it first will break the
-- admin portal, teacher dashboards, and timetable pages the same way the
-- admin-password migration did on the 12th - see that incident for why.
--
-- Why views instead of another column-level REVOKE: REVOKE SELECT (pin) ON
-- teacher_accounts was applied on the 12th and verified working, then found
-- silently reverted on the 15th with no SQL run in between (confirmed with
-- the school) - most likely the Supabase dashboard's Table Editor resetting
-- column grants when the table is opened/browsed there, since RLS itself
-- was never enabled on this table. payment_transactions and
-- school_credentials, which DO have RLS enabled with no policies, held
-- through the exact same window untouched. Column-level REVOKE plus
-- RLS-disabled is evidently not durable in this project; RLS-enabled with
-- no SELECT policy is what actually held. Views run as their owner (a
-- superuser, which bypasses RLS) and expose only the safe columns, so the
-- base table can be fully RLS-locked from anon/authenticated SELECT while
-- everything that only needed non-sensitive columns keeps working through
-- the view unaffected by whatever is resetting column grants.

-- ============================================================
-- 1. teacher_accounts.pin
-- ============================================================
ALTER TABLE teacher_accounts ENABLE ROW LEVEL SECURITY;

-- Preserves existing client-side write behavior exactly - none of the
-- current insert/update/delete call sites chain .select() afterward, so
-- none of them need a SELECT policy to keep working.
DROP POLICY IF EXISTS teacher_accounts_anon_insert ON teacher_accounts;
DROP POLICY IF EXISTS teacher_accounts_anon_update ON teacher_accounts;
DROP POLICY IF EXISTS teacher_accounts_anon_delete ON teacher_accounts;
CREATE POLICY teacher_accounts_anon_insert ON teacher_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY teacher_accounts_anon_update ON teacher_accounts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY teacher_accounts_anon_delete ON teacher_accounts FOR DELETE TO anon, authenticated USING (true);
-- Deliberately no SELECT policy - direct SELECT on the base table is fully
-- closed to anon/authenticated. service_role (this app's server actions)
-- bypasses RLS entirely regardless and is unaffected.

DROP VIEW IF EXISTS teacher_accounts_public;
CREATE VIEW teacher_accounts_public AS
SELECT id, school_id, email, first_name, last_name, is_active, created_at, updated_at, email_sent, phone_number, max_periods_per_day
FROM teacher_accounts;

GRANT SELECT ON teacher_accounts_public TO anon, authenticated;

-- Belt and suspenders against the same reset happening again unnoticed -
-- run this any time to check pin is still closed:
--   set role anon; select pin from teacher_accounts limit 1; reset role;
-- (should error - if it doesn't, something reset access again)

-- ============================================================
-- 2. classes.password
-- ============================================================
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_anon_insert ON classes;
DROP POLICY IF EXISTS classes_anon_update ON classes;
DROP POLICY IF EXISTS classes_anon_delete ON classes;
CREATE POLICY classes_anon_insert ON classes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY classes_anon_update ON classes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY classes_anon_delete ON classes FOR DELETE TO anon, authenticated USING (true);

DROP VIEW IF EXISTS classes_public;
CREATE VIEW classes_public AS
SELECT id, name, code, display_order, teacher_name, created_at, school_id
FROM classes;

GRANT SELECT ON classes_public TO anon, authenticated;

-- ============================================================
-- Verification - run after deploying code AND this script, expect an
-- error from each of the first two, and real data back from the second two:
--
--   set role anon;
--   select pin from teacher_accounts limit 1;          -- should error
--   select password from classes limit 1;               -- should error
--   select * from teacher_accounts_public limit 1;       -- should return rows, no pin column
--   select * from classes_public limit 1;                -- should return rows, no password column
--   reset role;
-- ============================================================
