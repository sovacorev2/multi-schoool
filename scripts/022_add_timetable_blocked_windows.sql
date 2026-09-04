-- Day-specific blocked time windows for the timetable generator - e.g.
-- "Monday 07:30-08:30 is assembly", "Friday 06:30-08:30 is church time",
-- "16:20-17:00 every day is discussion time". Fundamentally different from
-- timetable_breaks (which apply the same way every single day and are
-- baked into the shared period grid) since these can apply to just one day
-- of the week, so they're a separate table rather than an extension of
-- breaks.
--
-- class_id IS NULL = applies to every class in that category (like
-- timetable_settings/timetable_breaks' own category-vs-override split).
-- class_id IS NOT NULL = applies only to that one class (candidate classes
-- like Grade 6/9 with their own 1-hour-period override commonly need their
-- own blocked windows too, distinct from the rest of their category).
-- day_of_week NULL = applies every day; 1-6 = Monday-Saturday only.

CREATE TABLE IF NOT EXISTS timetable_blocked_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category text NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week int CHECK (day_of_week BETWEEN 1 AND 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetable_blocked_windows_school ON timetable_blocked_windows(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_blocked_windows_class ON timetable_blocked_windows(class_id) WHERE class_id IS NOT NULL;
