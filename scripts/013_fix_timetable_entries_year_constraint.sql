-- Fixes: "Failed to save generated timetable: duplicate key value violates
-- unique constraint timetable_entries_teacher_id_day_of_week_period_number_term_key"
--
-- scripts/008_add_timetable_tables.sql defines both uniqueness backstops on
-- timetable_entries as 5-column constraints including `year`:
--   UNIQUE (class_id, day_of_week, period_number, term, year)
--   UNIQUE (teacher_id, day_of_week, period_number, term, year)
-- But the constraint name Postgres reported in production
-- ("..._teacher_id_day_of_week_period_number_term_key", no "_year") proves
-- the constraint actually live on this table only has 4 columns - it
-- predates `year` being added to it, and "CREATE TABLE IF NOT EXISTS" never
-- re-applies changes to a table that already exists. Net effect: two
-- different years sharing the same term collide on insert for the same
-- teacher/day/period (or class/day/period), even though the app only clears
-- out the specific (school, term, year) being regenerated.
--
-- Finds whichever unique constraints are actually missing `year` (by column
-- set, not by guessed name) and replaces them with the correct 5-column
-- version - matching what fresh installs already get from script 008.

DO $$
DECLARE
  rec RECORD;
  col_names text[];
BEGIN
  FOR rec IN
    SELECT conname, conkey
    FROM pg_constraint
    WHERE conrelid = 'timetable_entries'::regclass AND contype = 'u'
  LOOP
    SELECT array_agg(a.attname ORDER BY k.ord)
    INTO col_names
    FROM unnest(rec.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = 'timetable_entries'::regclass AND a.attnum = k.attnum;

    CONTINUE WHEN 'year' = ANY(col_names);

    RAISE NOTICE 'Dropping stale timetable_entries constraint % (columns: %)', rec.conname, col_names;
    EXECUTE format('ALTER TABLE timetable_entries DROP CONSTRAINT %I', rec.conname);

    IF 'class_id' = ANY(col_names) THEN
      EXECUTE 'ALTER TABLE timetable_entries ADD CONSTRAINT timetable_entries_class_slot_key UNIQUE (class_id, day_of_week, period_number, term, year)';
    ELSIF 'teacher_id' = ANY(col_names) THEN
      EXECUTE 'ALTER TABLE timetable_entries ADD CONSTRAINT timetable_entries_teacher_slot_key UNIQUE (teacher_id, day_of_week, period_number, term, year)';
    END IF;
  END LOOP;
END $$;
