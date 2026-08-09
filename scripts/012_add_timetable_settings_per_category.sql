-- Timetable settings and breaks become per CBC level (Pre-School / Lower
-- Primary / Upper Primary / Junior Secondary) instead of one shared row per
-- school - a preschool's daily routine is nothing like a JSS class's, and
-- schools need to configure them independently (or make them match, their
-- choice).

ALTER TABLE timetable_settings ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE timetable_breaks ADD COLUMN IF NOT EXISTS category text;

-- Drop whatever the old UNIQUE(school_id) constraint on timetable_settings
-- is actually named (found dynamically rather than guessed, since it may
-- differ depending on how the table was originally created) and replace it
-- with one that allows up to one row per school PER category.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'timetable_settings'::regclass
    AND contype = 'u'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'timetable_settings'::regclass AND attname = 'school_id'
    )];
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE timetable_settings DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE timetable_settings
  ADD CONSTRAINT timetable_settings_school_category_key UNIQUE (school_id, category);

CREATE INDEX IF NOT EXISTS idx_timetable_breaks_school_category ON timetable_breaks(school_id, category);

-- Existing single settings/break rows predate categories and have category =
-- NULL - they're now orphaned (NULL never matches a real category lookup),
-- each level needs configuring once through the updated Settings tab.
