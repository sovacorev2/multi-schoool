-- New School Setup Script
-- Run this on a fresh Supabase project to set up the school database
-- Classes: PP1, PP2, Grade 1-9
-- Exam Types: Opener, Midterm, Endterm

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  display_order integer DEFAULT 0,
  teacher_name text,
  password text,
  created_at timestamptz DEFAULT now()
);

-- Learners table
CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  admission_number text,
  gender text CHECK (gender IN ('Male', 'Female', 'M', 'F')),
  stream_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- Exam types table
CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Sessions table (for exam session management)
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  exam_type_id uuid REFERENCES exam_types(id),
  year integer NOT NULL,
  term text NOT NULL,
  is_active boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  deadline_datetime timestamptz,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, exam_type_id, year, term)
);

-- Marks table
CREATE TABLE IF NOT EXISTS marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  year integer NOT NULL,
  term text NOT NULL,
  score numeric CHECK (score >= 0 AND score <= 100),
  exam_type_id uuid REFERENCES exam_types(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id),
  session_id uuid REFERENCES sessions(id),
  action text NOT NULL,
  details jsonb,
  performed_by text,
  created_at timestamptz DEFAULT now()
);

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Streams table (for class streams like A, B, C)
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_learners_class ON learners(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_marks_learner ON marks(learner_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_session ON marks(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_class ON audit_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_streams_class ON streams(class_id);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES (Allow all for anon - auth at app level)
-- =====================================================

-- Classes
CREATE POLICY "Allow all on classes" ON classes FOR ALL TO anon USING (true) WITH CHECK (true);

-- Learners
CREATE POLICY "Allow all on learners" ON learners FOR ALL TO anon USING (true) WITH CHECK (true);

-- Subjects
CREATE POLICY "Allow all on subjects" ON subjects FOR ALL TO anon USING (true) WITH CHECK (true);

-- Marks
CREATE POLICY "Allow all on marks" ON marks FOR ALL TO anon USING (true) WITH CHECK (true);

-- Sessions
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Exam types
CREATE POLICY "Allow all on exam_types" ON exam_types FOR ALL TO anon USING (true) WITH CHECK (true);

-- Audit logs
CREATE POLICY "Allow all on audit_logs" ON audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Admin settings
CREATE POLICY "Allow all on admin_settings" ON admin_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- Streams
CREATE POLICY "Allow all on streams" ON streams FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- 5. INSERT DEFAULT EXAM TYPES
-- =====================================================

INSERT INTO exam_types (name, description, display_order) VALUES
  ('Opener', 'Opening exam at the start of term', 1),
  ('Midterm', 'Mid-term examination', 2),
  ('Endterm', 'End of term examination', 3)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. INSERT DEFAULT CLASSES (PP1, PP2, Grade 1-9)
-- =====================================================

INSERT INTO classes (name, code, display_order) VALUES
  ('PP1', 'PP1', 1),
  ('PP2', 'PP2', 2),
  ('Grade 1', 'GRD1', 3),
  ('Grade 2', 'GRD2', 4),
  ('Grade 3', 'GRD3', 5),
  ('Grade 4', 'GRD4', 6),
  ('Grade 5', 'GRD5', 7),
  ('Grade 6', 'GRD6', 8),
  ('Grade 7', 'GRD7', 9),
  ('Grade 8', 'GRD8', 10),
  ('Grade 9', 'GRD9', 11)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 7. INSERT DEFAULT ADMIN PASSWORD
-- =====================================================
-- Default admin password: admin123 (change this in Settings after setup)

INSERT INTO admin_settings (key, value) VALUES
  ('admin_password', 'admin123')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Next steps:
-- 1. Set your school name in Vercel environment variables:
--    NEXT_PUBLIC_SCHOOL_NAME=Your School Name
--    NEXT_PUBLIC_SCHOOL_SHORT_NAME=YourSchool
--    NEXT_PUBLIC_SCHOOL_TAGLINE=Your Motto
-- 2. Connect your Supabase project to Vercel
-- 3. Change the admin password in Settings
