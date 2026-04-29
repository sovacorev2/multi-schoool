-- Multi-tenant migration: Add schools table and school_id to all tables
-- This allows multiple schools to use the same database

-- 1. Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  code text UNIQUE NOT NULL,
  tagline text,
  email text,
  phone text,
  address text,
  logo_url text,
  primary_color text DEFAULT '#2563eb',
  admin_password text NOT NULL DEFAULT 'admin123',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Insert the current school (St James Koteko) as the first school
INSERT INTO schools (name, short_name, code, tagline, admin_password)
VALUES ('St James Koteko Primary School', 'SJKPS', 'stjames', 'Arise and Shine', 'admin123')
ON CONFLICT (code) DO NOTHING;

-- 3. Add school_id column to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- 4. Update existing classes to belong to St James Koteko
UPDATE classes SET school_id = (SELECT id FROM schools WHERE code = 'stjames') WHERE school_id IS NULL;

-- 5. Make school_id NOT NULL after data migration
-- ALTER TABLE classes ALTER COLUMN school_id SET NOT NULL;

-- 6. Add school_id to exam_sessions if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exam_sessions') THEN
    ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
    UPDATE exam_sessions SET school_id = (SELECT id FROM schools WHERE code = 'stjames') WHERE school_id IS NULL;
  END IF;
END $$;

-- 7. Add school_id to users table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
    UPDATE users SET school_id = (SELECT id FROM schools WHERE code = 'stjames') WHERE school_id IS NULL;
  END IF;
END $$;

-- 8. Create indexes for school_id columns
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);

-- 9. Add unique constraint for class code within a school
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_code_key;
ALTER TABLE classes ADD CONSTRAINT classes_school_code_unique UNIQUE (school_id, code);

-- 10. Enable RLS on schools table
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for schools
CREATE POLICY "Allow public read access to schools"
  ON schools FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Allow authenticated full access to schools"
  ON schools FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 12. Function to add a new school with default classes
CREATE OR REPLACE FUNCTION add_new_school(
  p_name text,
  p_short_name text,
  p_code text,
  p_tagline text DEFAULT '',
  p_admin_password text DEFAULT 'admin123'
)
RETURNS uuid AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Insert the new school
  INSERT INTO schools (name, short_name, code, tagline, admin_password)
  VALUES (p_name, p_short_name, p_code, p_tagline, p_admin_password)
  RETURNING id INTO v_school_id;
  
  -- Insert default classes for the school
  INSERT INTO classes (school_id, name, code, password) VALUES
    (v_school_id, 'PP1', 'PP1', p_code || 'PP1'),
    (v_school_id, 'PP2', 'PP2', p_code || 'PP2'),
    (v_school_id, 'Grade 1', 'GRD1', p_code || 'GRD1'),
    (v_school_id, 'Grade 2', 'GRD2', p_code || 'GRD2'),
    (v_school_id, 'Grade 3', 'GRD3', p_code || 'GRD3'),
    (v_school_id, 'Grade 4', 'GRD4', p_code || 'GRD4'),
    (v_school_id, 'Grade 5', 'GRD5', p_code || 'GRD5'),
    (v_school_id, 'Grade 6', 'GRD6', p_code || 'GRD6'),
    (v_school_id, 'Grade 7', 'GRD7', p_code || 'GRD7'),
    (v_school_id, 'Grade 8', 'GRD8', p_code || 'GRD8'),
    (v_school_id, 'Grade 9', 'GRD9', p_code || 'GRD9');
  
  RETURN v_school_id;
END;
$$ LANGUAGE plpgsql;

-- Example: To add the new school, run:
-- SELECT add_new_school('New School Name', 'NSN', 'newschool', 'School Motto', 'adminpassword');
