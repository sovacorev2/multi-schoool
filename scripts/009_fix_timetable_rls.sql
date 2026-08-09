-- Fixes "new row violates row-level security policy" on timetable_settings,
-- timetable_breaks, and timetable_entries.
--
-- scripts/008 already included these same DISABLE statements, but verified
-- directly against the live database that all three tables still have RLS
-- enabled with no permissive policy, blocking every write. Re-running this
-- (or all of scripts/008 again, which is idempotent) fixes it.
ALTER TABLE timetable_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_breaks DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries DISABLE ROW LEVEL SECURITY;
