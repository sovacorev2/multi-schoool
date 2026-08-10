-- Double lessons (2 consecutive periods, same subject) are a Junior
-- Secondary convention for STEM subjects - not something Pre-School, Lower,
-- or Upper Primary classes need, and schools should be able to turn it off
-- even for JSS if they don't want it. Adds a per-level toggle, defaulting to
-- on for Junior Secondary (matching current behavior for that level) and off
-- everywhere else (a real behavior change for the other three levels, which
-- previously got doubles unconditionally).

ALTER TABLE timetable_settings ADD COLUMN IF NOT EXISTS enable_double_lessons boolean NOT NULL DEFAULT false;

UPDATE timetable_settings SET enable_double_lessons = true WHERE category = 'Junior Secondary';
