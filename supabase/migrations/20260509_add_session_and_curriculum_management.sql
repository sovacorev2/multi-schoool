-- Add is_active flag to sessions table for filtering live vs archived sessions
-- Set all existing sessions to is_active = true (they are considered live until marked otherwise)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
UPDATE sessions SET is_active = true WHERE is_active IS NULL;

-- Create index for filtering active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_school_active ON sessions(school_id, is_active);

-- Add school_curriculum table for admin curriculum configuration
CREATE TABLE IF NOT EXISTS school_curriculum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT true,
  approved_by_admin boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(school_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_school_curriculum_school ON school_curriculum(school_id);
CREATE INDEX IF NOT EXISTS idx_school_curriculum_enabled ON school_curriculum(school_id, is_enabled);

-- Add teacher subject selection table
CREATE TABLE IF NOT EXISTS class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON class_subjects(subject_id);
