-- Timetable generator: per-subject period requirements, school-wide schedule
-- settings, break configuration, and the generated timetable itself.
--
-- Subjects and teacher-to-class/subject assignments already exist (subjects,
-- teacher_assignments) - this only adds what's actually missing: how many
-- periods per week a subject needs, an optional daily cap per teacher, the
-- school's timing configuration, and the generated entries.

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS periods_per_week integer NOT NULL DEFAULT 5;
ALTER TABLE teacher_accounts ADD COLUMN IF NOT EXISTS max_periods_per_day integer;

CREATE TABLE IF NOT EXISTS timetable_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  school_start_time text NOT NULL DEFAULT '08:00',
  school_end_time text NOT NULL DEFAULT '16:00',
  period_length_minutes integer NOT NULL DEFAULT 40,
  days_per_week integer NOT NULL DEFAULT 5,
  avoid_consecutive_same_subject boolean NOT NULL DEFAULT true,
  spread_evenly boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timetable_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- The break falls immediately after this many teaching periods have run.
  -- Clock times are derived from settings + breaks on the fly rather than
  -- stored, so changing school hours or period length doesn't require
  -- rewriting stored times.
  after_period_number integer NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetable_breaks_school ON timetable_breaks(school_id);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teacher_accounts(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL,
  period_number integer NOT NULL,
  term text NOT NULL,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One subject per class-slot per term.
  UNIQUE (class_id, day_of_week, period_number, term, year),
  -- A teacher can't be in two places at once - the generator already
  -- guarantees this, this is a DB-level backstop.
  UNIQUE (teacher_id, day_of_week, period_number, term, year)
);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_school_term ON timetable_entries(school_id, term, year);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_class ON timetable_entries(class_id, term, year);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_teacher ON timetable_entries(teacher_id, term, year);

-- Matches this app's existing tables, which are read/written directly from
-- the browser via the publishable/anon key with no Supabase Auth session -
-- RLS is intentionally left OFF here so these new tables are reachable the
-- same way. Learned the hard way this session (schools, payment_transactions,
-- teacher_deadline_overrides all silently blocked writes until this was
-- disabled explicitly) - do not skip this on any future migration either.
ALTER TABLE timetable_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_breaks DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries DISABLE ROW LEVEL SECURITY;
