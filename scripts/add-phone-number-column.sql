-- Add phone_number column to teacher_accounts table if it doesn't exist
ALTER TABLE teacher_accounts
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN teacher_accounts.phone_number IS 'Teacher phone number for WhatsApp notifications (includes country code, e.g. +254123456789)';
