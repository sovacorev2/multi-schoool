-- Fixes: "Failed to save generated timetable: duplicate key value violates
-- unique constraint timetable_entries_teacher_id_day_of_week_period_number_term_key"
-- still happening after 013, on a school's FIRST-ever generation for a term
-- (Amagoro, Term 1 2026) - so this isn't the stale-year collision 013 fixed.
--
-- Root cause: this constraint was written back when the whole school shared
-- one timetable_settings row, so `period_number` meant the same clock time
-- for every class - "same teacher, same day_of_week, same period_number"
-- really did mean "same teacher, two places at once." Settings are now per
-- CBC level (Pre-School/Lower/Upper Primary/Junior Secondary), each with its
-- own hours and period length, so period_number 3 in Pre-School and period
-- number 3 in Junior Secondary are usually two completely different, non-
-- overlapping real times. A specialist or head teacher teaching both levels
-- at the same period_number-but-different-actual-time now trips this
-- constraint even though nothing actually conflicts - exactly what the
-- generator's clock-time overlap check (lib/timetable-generator.ts) already
-- verified before trying to save.
--
-- period_number alone can no longer serve as a real-time proxy across
-- categories, so this DB-level backstop is dropped rather than reworked -
-- the generator's clock-time interval check is the authoritative guard now.
-- The class_id-based sibling constraint is untouched: a single class's own
-- day/period grid is still one axis, unaffected by other levels' settings.

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

    CONTINUE WHEN NOT ('teacher_id' = ANY(col_names));

    RAISE NOTICE 'Dropping invalid teacher_id constraint % (columns: %)', rec.conname, col_names;
    EXECUTE format('ALTER TABLE timetable_entries DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;
