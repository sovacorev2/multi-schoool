-- Add teacher_pin and class_id columns to activity_logs table for better audit trail tracking
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS teacher_pin TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS class_id TEXT;

-- Create index on teacher_pin for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_teacher_pin ON activity_logs(teacher_pin);
CREATE INDEX IF NOT EXISTS idx_activity_logs_class_id ON activity_logs(class_id);

-- Add comment to table explaining the new columns
COMMENT ON COLUMN activity_logs.teacher_pin IS 'Teacher PIN who performed the action - for precise identification';
COMMENT ON COLUMN activity_logs.class_id IS 'Class ID affected by the action';
