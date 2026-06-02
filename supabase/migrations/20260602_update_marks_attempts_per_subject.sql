-- Modify marks_entry_attempts to track per subject instead of per session
-- This allows each teacher to have independent attempt counts for each subject

-- Add subject_id column
ALTER TABLE marks_entry_attempts ADD COLUMN subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE;

-- Update the unique constraint to be per session + subject instead of just session
ALTER TABLE marks_entry_attempts DROP CONSTRAINT IF EXISTS marks_entry_attempts_session_id_school_id_key;

-- Add new unique constraint
ALTER TABLE marks_entry_attempts ADD CONSTRAINT marks_entry_attempts_session_subject_key UNIQUE(session_id, subject_id, school_id);

-- Create index for faster subject lookups
CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_subject ON marks_entry_attempts(subject_id);
