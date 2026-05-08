-- Create global subjects table for Kenyan CBC curriculum
-- This allows admins to enable/disable subjects at the school level
-- Teachers then select from enabled subjects for their specific classes

CREATE TABLE IF NOT EXISTS global_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_disabled boolean DEFAULT false,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_subjects_school ON global_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_global_subjects_enabled ON global_subjects(school_id, is_disabled);

-- Create class-level subject mappings (teachers select from global subjects for their class)
CREATE TABLE IF NOT EXISTS class_enabled_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  global_subject_id uuid NOT NULL REFERENCES global_subjects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, global_subject_id)
);

CREATE INDEX IF NOT EXISTS idx_class_enabled_subjects_class ON class_enabled_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enabled_subjects_subject ON class_enabled_subjects(global_subject_id);

-- Add is_disabled and is_custom to old subjects table for backward compatibility
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_disabled boolean DEFAULT false;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code text;
