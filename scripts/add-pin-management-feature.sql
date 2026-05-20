-- Add feature_pin_management column to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS feature_pin_management boolean DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_schools_feature_pin_management 
ON schools(feature_pin_management);
