-- Add password columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS password_set BOOLEAN DEFAULT FALSE;
