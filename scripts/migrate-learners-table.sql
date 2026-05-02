-- Migration: Add missing columns to learners table for multi-tenant support

-- 1. Add school_id column to learners table
ALTER TABLE learners ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- 2. Add parent_phone column to learners table
ALTER TABLE learners ADD COLUMN IF NOT EXISTS parent_phone text;

-- 3. Add birth_cert_number column to learners table
ALTER TABLE learners ADD COLUMN IF NOT EXISTS birth_cert_number text;

-- 4. Update existing learners to belong to the default school (St James Koteko)
UPDATE learners 
SET school_id = (SELECT id FROM schools WHERE code = 'stjames') 
WHERE school_id IS NULL AND class_id IN (
  SELECT id FROM classes WHERE school_id = (SELECT id FROM schools WHERE code = 'stjames')
);

-- 5. Create index for school_id on learners table
CREATE INDEX IF NOT EXISTS idx_learners_school ON learners(school_id);

-- 6. Add RLS policy for learners with school_id
DROP POLICY IF EXISTS "Allow public insert to learners" ON learners;
CREATE POLICY "Allow public insert to learners" ON learners FOR INSERT TO anon WITH CHECK (true);

-- 7. Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'learners'
ORDER BY ordinal_position;
