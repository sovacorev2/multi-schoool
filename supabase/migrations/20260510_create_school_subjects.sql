-- Create school_subjects table for admin curriculum management
-- This stores which subjects are enabled/available at the school level
CREATE TABLE IF NOT EXISTS school_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_subjects_school ON school_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subjects_enabled ON school_subjects(school_id, is_enabled);

-- Create class_enabled_subjects table to link classes to school-level subjects
CREATE TABLE IF NOT EXISTS class_enabled_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_code text NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE(class_id, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_class_enabled_subjects_class ON class_enabled_subjects(class_id);
