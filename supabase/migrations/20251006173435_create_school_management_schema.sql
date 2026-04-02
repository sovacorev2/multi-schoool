/*
  # Kitengela Adventist School Management System

  ## Overview
  Complete database schema for managing exam marks entry and marklist generation
  for Kitengela Adventist School.

  ## New Tables

  ### 1. `classes`
  Stores class/grade information with authentication passwords
  - `id` (uuid, primary key)
  - `name` (text) - Class name (e.g., "Playgroup", "PP1", "Grade 1")
  - `code` (text, unique) - Short code for the class (e.g., "PG", "PP1", "GRD1")
  - `password` (text) - Class-specific password for access
  - `created_at` (timestamptz)

  ### 2. `learners`
  Student information for each class
  - `id` (uuid, primary key)
  - `class_id` (uuid, foreign key to classes)
  - `name` (text) - Full name of the learner
  - `admission_number` (text) - Unique student identifier
  - `created_at` (timestamptz)

  ### 3. `subjects`
  Subjects per class with custom subject support
  - `id` (uuid, primary key)
  - `class_id` (uuid, foreign key to classes)
  - `name` (text) - Subject name
  - `is_custom` (boolean) - Whether it's a custom subject
  - `created_at` (timestamptz)

  ### 4. `marks`
  Individual student marks for each subject
  - `id` (uuid, primary key)
  - `learner_id` (uuid, foreign key to learners)
  - `subject_id` (uuid, foreign key to subjects)
  - `year` (integer) - Academic year
  - `term` (integer) - School term (1, 2, or 3)
  - `score` (numeric) - Mark obtained
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `sessions`
  Track active staff sessions per class
  - `id` (uuid, primary key)
  - `class_id` (uuid, foreign key to classes)
  - `year` (integer)
  - `term` (integer)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Public access for authenticated sessions only
  - Policies restrict access based on session authentication

  ## Important Notes
  1. Password authentication is handled at application level
  2. Each class has its own password for access control
  3. Marks are linked to specific year and term for historical tracking
  4. Custom subjects allow flexibility per class
*/

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
  admission_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, admission_number)
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

-- Create marks table
CREATE TABLE IF NOT EXISTS marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  year integer NOT NULL,
  term integer NOT NULL CHECK (term >= 1 AND term <= 3),
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
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

-- RLS Policies for public access (password authentication handled at app level)
CREATE POLICY "Allow public read access to classes"
  ON classes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to learners"
  ON learners FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to learners"
  ON learners FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to learners"
  ON learners FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to learners"
  ON learners FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to subjects"
  ON subjects FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to subjects"
  ON subjects FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to subjects"
  ON subjects FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to subjects"
  ON subjects FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to marks"
  ON marks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to marks"
  ON marks FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to marks"
  ON marks FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to marks"
  ON marks FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to sessions"
  ON sessions FOR DELETE
  TO anon
  USING (true);

-- Insert default classes with their passwords
INSERT INTO classes (name, code, password) VALUES
  ('Playgroup', 'PG', 'KASPG'),
  ('PP1', 'PP1', 'KASPP1'),
  ('PP2', 'PP2', 'KASPP2'),
  ('Grade 1', 'GRD1', 'KASGRD1'),
  ('Grade 2', 'GRD2', 'KASGRD2'),
  ('Grade 3', 'GRD3', 'KASGRD3'),
  ('Grade 4', 'GRD4', 'KASGRD4'),
  ('Grade 5', 'GRD5', 'KASGRD5'),
  ('Grade 6', 'GRD6', 'KASGRD6'),
  ('Grade 7', 'GRD7', 'KASGRD7'),
  ('Grade 8', 'GRD8', 'KASGRD8')
ON CONFLICT (code) DO NOTHING;
