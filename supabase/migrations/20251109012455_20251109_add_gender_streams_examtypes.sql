/*
  # Add Gender, Streams, Exam Types, and Analytics

  1. New Tables
    - `streams` - For class streams/sections
    - `exam_types` - Store opener/midterm/endterm classification
    - `analytics_sessions` - Store exam session metadata
    - `gender_performance` - Cache gender-based performance metrics
    
  2. Modified Tables
    - `learners` - Add gender field
    - `marks` - Add exam_type_id and analytics_session_id
    
  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for class access
*/

-- Create streams table
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streams viewable by class"
  ON streams FOR SELECT
  TO authenticated
  USING (true);

-- Create exam_types table
CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO exam_types (name, description) VALUES
  ('opener', 'Opening exam'),
  ('midterm', 'Mid-term exam'),
  ('endterm', 'End of term exam')
ON CONFLICT DO NOTHING;

ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exam types viewable by all"
  ON exam_types FOR SELECT
  TO authenticated
  USING (true);

-- Add gender column to learners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learners' AND column_name = 'gender'
  ) THEN
    ALTER TABLE learners ADD COLUMN gender text CHECK (gender IN ('M', 'F'));
  END IF;
END $$;

-- Add stream_id to learners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learners' AND column_name = 'stream_id'
  ) THEN
    ALTER TABLE learners ADD COLUMN stream_id uuid REFERENCES streams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create analytics_sessions table to store exam metadata
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  year integer NOT NULL,
  term integer NOT NULL CHECK (term >= 1 AND term <= 3),
  exam_type_id uuid NOT NULL REFERENCES exam_types(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, stream_id, year, term, exam_type_id)
);

ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics sessions viewable by class"
  ON analytics_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Analytics sessions insertable by class"
  ON analytics_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add exam_type_id and analytics_session_id to marks (migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marks' AND column_name = 'exam_type_id'
  ) THEN
    ALTER TABLE marks ADD COLUMN exam_type_id uuid REFERENCES exam_types(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marks' AND column_name = 'analytics_session_id'
  ) THEN
    ALTER TABLE marks ADD COLUMN analytics_session_id uuid REFERENCES analytics_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create gender_performance view/table for analytics
CREATE TABLE IF NOT EXISTS gender_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analytics_session_id uuid NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  gender text NOT NULL CHECK (gender IN ('M', 'F')),
  avg_score numeric,
  total_students integer,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(analytics_session_id, subject_id, gender)
);

ALTER TABLE gender_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gender performance viewable by class"
  ON gender_performance FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_learners_stream ON learners(stream_id);
CREATE INDEX IF NOT EXISTS idx_learners_gender ON learners(gender);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_class ON analytics_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_stream ON analytics_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_gender_performance_session ON gender_performance(analytics_session_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam_type ON marks(exam_type_id);
CREATE INDEX IF NOT EXISTS idx_marks_analytics_session ON marks(analytics_session_id);
