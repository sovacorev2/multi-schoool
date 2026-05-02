# Database Migration Required - Add Learners Table Columns

## Problem
The "Add Learner" button is not working because the database schema is missing required columns for the new multi-tenant school system.

## Missing Columns
1. **school_id** - Required to link learners to specific schools
2. **parent_phone** - For parent contact information  
3. **birth_cert_number** - For learner identification

## Solution - Run This SQL in Supabase

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Create a new query and run **ALL** the SQL below:

```sql
-- Step 1: Add missing columns to learners table
ALTER TABLE learners ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS parent_phone text;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS birth_cert_number text;

-- Step 2: Create index for school_id
CREATE INDEX IF NOT EXISTS idx_learners_school ON learners(school_id);

-- Step 3: Update existing learners to belong to the default school
UPDATE learners 
SET school_id = (SELECT id FROM schools WHERE code = 'stjames' LIMIT 1)
WHERE school_id IS NULL;

-- Step 4: Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'learners'
ORDER BY ordinal_position;
```

## Expected Output
After running the SQL, you should see columns:
- `id` (uuid, not null)
- `class_id` (uuid, not null)
- `name` (text, not null)
- `admission_number` (text, nullable)
- `gender` (text, nullable)
- `stream_id` (uuid, nullable)
- `created_at` (timestamp, nullable)
- **`school_id`** (uuid, nullable) ← NEW
- **`parent_phone`** (text, nullable) ← NEW
- **`birth_cert_number`** (text, nullable) ← NEW

## After Migration
1. Refresh your browser
2. Go to Manage Learners page
3. Try adding a learner again - it should work!

## Troubleshooting
- If you get "column already exists" errors, that's OK - it means the columns are already there
- Make sure you have selected a class and a school before trying to add learners
- Check browser console (F12) for detailed error messages

## For New Schools
When registering a new school through the setup form:
1. The classes are automatically created
2. Learners can now be added to those classes
3. Each learner is linked to the school through the school_id column
