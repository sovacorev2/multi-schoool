/*
  # Make Admission Number Optional

  ## Changes
  1. Modify the `learners` table to make `admission_number` nullable
  2. Update the unique constraint to handle nullable admission numbers
  3. Drop the old unique constraint and create a new one that only applies when admission_number is not null

  ## Reasoning
  For primary school settings, admission numbers may not always be available or used,
  especially for younger grades. Making this field optional provides more flexibility.
*/

-- Drop the existing unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'learners_class_id_admission_number_key'
    AND table_name = 'learners'
  ) THEN
    ALTER TABLE learners DROP CONSTRAINT learners_class_id_admission_number_key;
  END IF;
END $$;

-- Make admission_number nullable
ALTER TABLE learners ALTER COLUMN admission_number DROP NOT NULL;

-- Set default empty string for existing null values
UPDATE learners SET admission_number = '' WHERE admission_number IS NULL;

-- Create a unique index that only applies when admission_number is not empty
CREATE UNIQUE INDEX IF NOT EXISTS learners_class_admission_unique 
  ON learners(class_id, admission_number) 
  WHERE admission_number != '';
