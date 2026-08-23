-- Per-class timetable overrides. Candidate classes (Grade 6, Grade 9 - the
-- classes sitting KCPE/KJSEA-equivalent exams) commonly need their own
-- schedule structure (most often longer, 1-hour periods for exam pacing)
-- distinct from the rest of their CBC level, which settings could previously
-- only be configured per category (Pre-School/Lower/Upper Primary/JSS).
--
-- class_id IS NULL on a row = today's category-wide row (unchanged).
-- class_id IS NOT NULL = an override for exactly that one class, taking full
-- precedence over its category's row for that class only.

ALTER TABLE timetable_settings ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE timetable_breaks ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE CASCADE;

-- Replace the existing UNIQUE(school_id, category) on timetable_settings
-- (found dynamically, not guessed - matches the technique already used in
-- scripts/012 for this exact table) with two partial unique indexes: at
-- most one category-wide row per (school, category) when class_id is null,
-- and at most one override row per (school, class) when class_id is set.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'timetable_settings'::regclass
    AND contype = 'u'
    AND conkey = ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'timetable_settings'::regclass AND attname = 'school_id'),
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'timetable_settings'::regclass AND attname = 'category')
    ];
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE timetable_settings DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_settings_category_unique
  ON timetable_settings(school_id, category) WHERE class_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS timetable_settings_class_unique
  ON timetable_settings(school_id, class_id) WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_breaks_class ON timetable_breaks(class_id) WHERE class_id IS NOT NULL;
