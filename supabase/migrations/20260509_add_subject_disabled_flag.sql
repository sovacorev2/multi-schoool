-- Add is_disabled flag to subjects table for admin subject management
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_disabled boolean DEFAULT false;

-- Create index for filtering active subjects
CREATE INDEX IF NOT EXISTS idx_subjects_disabled ON subjects(school_id, is_disabled);
