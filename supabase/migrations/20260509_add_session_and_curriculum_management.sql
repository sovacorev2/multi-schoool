-- Add is_active flag to sessions table for filtering live vs archived sessions
ALTER TABLE sessions ADD COLUMN is_active boolean DEFAULT true;

-- Create index for filtering active sessions
CREATE INDEX idx_sessions_school_active ON sessions(school_id, is_active);

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

CREATE INDEX idx_school_curriculum_school ON school_curriculum(school_id);
CREATE INDEX idx_school_curriculum_enabled ON school_curriculum(school_id, is_enabled);

-- Add teacher subject selection table
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(teacher_id, school_id, subject_id, class_id)
);

CREATE INDEX idx_teacher_subjects_teacher ON teacher_subjects(teacher_id, school_id);
CREATE INDEX idx_teacher_subjects_subject ON teacher_subjects(subject_id);
