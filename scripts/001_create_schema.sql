-- Success Academy Marklist Automation System
-- Database Schema

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create learners table
CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  admission_number text,
  gender text CHECK (gender IN ('M', 'F')),
  stream_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- Create exam_types table
CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create marks table
CREATE TABLE IF NOT EXISTS marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  year integer NOT NULL,
  term integer NOT NULL CHECK (term >= 1 AND term <= 3),
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  exam_type_id uuid REFERENCES exam_types(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(learner_id, subject_id, year, term)
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  year integer NOT NULL,
  term integer NOT NULL CHECK (term >= 1 AND term <= 3),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_learners_class ON learners(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_marks_learner ON marks(learner_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_year_term ON marks(year, term);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON sessions(class_id);

-- Enable Row Level Security
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public access (password authentication handled at app level)
CREATE POLICY "Allow public read access to classes" ON classes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access to learners" ON learners FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert to learners" ON learners FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update to learners" ON learners FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to learners" ON learners FOR DELETE TO anon USING (true);
CREATE POLICY "Allow public read access to subjects" ON subjects FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert to subjects" ON subjects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update to subjects" ON subjects FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to subjects" ON subjects FOR DELETE TO anon USING (true);
CREATE POLICY "Allow public read access to marks" ON marks FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert to marks" ON marks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update to marks" ON marks FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to marks" ON marks FOR DELETE TO anon USING (true);
CREATE POLICY "Allow public read access to sessions" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert to sessions" ON sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update to sessions" ON sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to sessions" ON sessions FOR DELETE TO anon USING (true);
CREATE POLICY "Allow public read access to exam_types" ON exam_types FOR SELECT TO anon USING (true);

-- Insert default exam types
INSERT INTO exam_types (name, description) VALUES
  ('opener', 'Opening exam'),
  ('midterm', 'Mid-term exam'),
  ('endterm', 'End of term exam')
ON CONFLICT (name) DO NOTHING;

-- Insert default classes for Success Academy
INSERT INTO classes (name, code, password) VALUES
  ('Playgroup', 'PG', 'SAPG2025'),
  ('PP1', 'PP1', 'SAPP12025'),
  ('PP2', 'PP2', 'SAPP22025'),
  ('Grade 1', 'GRD1', 'SAGRD12025'),
  ('Grade 2', 'GRD2', 'SAGRD22025'),
  ('Grade 3', 'GRD3', 'SAGRD32025'),
  ('Grade 4', 'GRD4', 'SAGRD42025'),
  ('Grade 5', 'GRD5', 'SAGRD52025'),
  ('Grade 6', 'GRD6', 'SAGRD62025'),
  ('Grade 7', 'GRD7', 'SAGRD72025'),
  ('Grade 8', 'GRD8', 'SAGRD82025')
ON CONFLICT (code) DO NOTHING;
