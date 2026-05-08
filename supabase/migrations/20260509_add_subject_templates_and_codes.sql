-- Add subject code column to subjects table (for standardized subject codes in marksheets)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code TEXT;

-- Create subject_templates table for standardized subjects by level
CREATE TABLE IF NOT EXISTS subject_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('grade-1-3', 'grade-4-6', 'jss')),
  is_variant BOOLEAN DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(code, level)
);

-- Insert standard subject templates for Grade 1-3
INSERT INTO subject_templates (name, code, level, is_variant) VALUES
  ('English Language Activities', 'ENG', 'grade-1-3', false),
  ('Kiswahili Language Activities', 'KIS', 'grade-1-3', false),
  ('Environmental Activities', 'ENV', 'grade-1-3', false),
  ('Creative Activities', 'CAS', 'grade-1-3', false),
  ('Christian Religious Education Activities', 'CRE', 'grade-1-3', false),
  ('Mathematics Activities', 'MAT', 'grade-1-3', false)
ON CONFLICT DO NOTHING;

-- Insert standard subject templates for Grade 4-6
INSERT INTO subject_templates (name, code, level, is_variant) VALUES
  ('English', 'ENG', 'grade-4-6', false),
  ('Kiswahili', 'KIS', 'grade-4-6', false),
  ('Mathematics', 'MAT', 'grade-4-6', false),
  ('Creative Arts', 'CAS', 'grade-4-6', false),
  ('Agriculture & Nutrition', 'AGRI/NUT', 'grade-4-6', false),
  ('Social Studies', 'SST', 'grade-4-6', false),
  ('Social Studies + Religious Education', 'SSRE', 'grade-4-6', true),
  ('Religious Education', 'RE', 'grade-4-6', false),
  ('Science & Technology', 'SCI/TECH', 'grade-4-6', false)
ON CONFLICT DO NOTHING;

-- Insert standard subject templates for JSS
INSERT INTO subject_templates (name, code, level, is_variant) VALUES
  ('English', 'ENG', 'jss', false),
  ('Kiswahili', 'KIS', 'jss', false),
  ('Mathematics', 'MAT', 'jss', false),
  ('Creative Arts', 'CAS', 'jss', false),
  ('Agriculture', 'AGRI', 'jss', false),
  ('Social Studies', 'SST', 'jss', false),
  ('Social Studies + Religious Education', 'SSRE', 'jss', true),
  ('Religious Education', 'RE', 'jss', false),
  ('Integrated Science', 'INT/SCIENCE', 'jss', false),
  ('Pre-Technical Studies', 'PRE-TECH', 'jss', false)
ON CONFLICT DO NOTHING;

-- Add school_level to schools table if not present
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_level TEXT DEFAULT 'primary' CHECK (school_level IN ('primary', 'jss'));

-- Add curriculum_configured flag to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS curriculum_configured BOOLEAN DEFAULT false;
