-- Per-teacher (per-subject) deadline overrides.
--
-- Deadlines currently live on `sessions` (one deadline per class+exam,
-- shared by every subject/teacher in that class). This table lets an admin
-- grant an individual teacher (identified by their subject within a class
-- session) a different deadline than the rest of the class, without
-- affecting anyone else's.
--
-- A row's presence means "this subject has an override for this session";
-- deleting the row reverts that subject back to the session's own deadline.

CREATE TABLE IF NOT EXISTS teacher_deadline_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  deadline_datetime timestamptz NOT NULL,
  set_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_deadline_overrides_session
  ON teacher_deadline_overrides(session_id);

-- Matches this app's existing tables (sessions, marks, classes, etc.), which
-- are read/written directly from the browser via the publishable/anon key
-- with no Supabase Auth session - RLS is intentionally left off here so this
-- new table is reachable the same way. If your other tables DO have RLS
-- policies enabled, add an equivalent permissive policy here instead:
--   ALTER TABLE teacher_deadline_overrides ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "Deadline overrides accessible to app" ON teacher_deadline_overrides
--     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
