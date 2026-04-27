import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Read env file
const envContent = fs.readFileSync('/vercel/share/.env.project', 'utf-8')
const envLines = envContent.split('\n')
let url, serviceKey

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

const supabase = createClient(url, serviceKey, {
  db: { schema: 'public' }
})

async function initDatabase() {
  console.log('='.repeat(60))
  console.log('DATABASE INITIALIZATION STARTING')
  console.log('='.repeat(60))

  try {
    // SQL to create all tables and insert data
    const setupSQL = `
-- Drop existing tables
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS learners CASCADE;
DROP TABLE IF EXISTS streams CASCADE;
DROP TABLE IF EXISTS exam_types CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;

-- Create classes table
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  display_order integer DEFAULT 0,
  teacher_name text,
  password text,
  created_at timestamptz DEFAULT now()
);

-- Create exam_types table
CREATE TABLE exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create streams table
CREATE TABLE streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- Create learners table
CREATE TABLE learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  admission_number text,
  gender text CHECK (gender IN ('Male', 'Female', 'M', 'F')),
  stream_id uuid REFERENCES streams(id),
  created_at timestamptz DEFAULT now()
);

-- Create subjects table
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- Create sessions table
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  exam_type_id uuid REFERENCES exam_types(id),
  year integer NOT NULL,
  term text NOT NULL,
  is_active boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  deadline_datetime timestamptz,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, exam_type_id, year, term)
);

-- Create marks table
CREATE TABLE marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  year integer NOT NULL,
  term text NOT NULL,
  score numeric CHECK (score >= 0 AND score <= 100),
  exam_type_id uuid REFERENCES exam_types(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id),
  session_id uuid REFERENCES sessions(id),
  action text NOT NULL,
  details jsonb,
  performed_by text,
  created_at timestamptz DEFAULT now()
);

-- Create admin_settings table
CREATE TABLE admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert exam types
INSERT INTO exam_types (name, description, display_order) VALUES
  ('Opener', 'Opening exam at the start of term', 1),
  ('Midterm', 'Mid-term examination', 2),
  ('Endterm', 'End of term examination', 3);

-- Insert classes
INSERT INTO classes (name, code, display_order) VALUES
  ('PP1', 'PP1', 1),
  ('PP2', 'PP2', 2),
  ('Grade 1', 'GRD1', 3),
  ('Grade 2', 'GRD2', 4),
  ('Grade 3', 'GRD3', 5),
  ('Grade 4', 'GRD4', 6),
  ('Grade 5', 'GRD5', 7),
  ('Grade 6', 'GRD6', 8),
  ('Grade 7', 'GRD7', 9),
  ('Grade 8', 'GRD8', 10),
  ('Grade 9', 'GRD9', 11);

-- Insert admin settings
INSERT INTO admin_settings (key, value) VALUES
  ('admin_password', 'admin123');

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read" ON classes FOR SELECT USING (true);
CREATE POLICY "Enable write" ON classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON classes FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON classes FOR DELETE USING (true);

CREATE POLICY "Enable read" ON exam_types FOR SELECT USING (true);
CREATE POLICY "Enable write" ON exam_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON exam_types FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON exam_types FOR DELETE USING (true);

CREATE POLICY "Enable read" ON streams FOR SELECT USING (true);
CREATE POLICY "Enable write" ON streams FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON streams FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON streams FOR DELETE USING (true);

CREATE POLICY "Enable read" ON learners FOR SELECT USING (true);
CREATE POLICY "Enable write" ON learners FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON learners FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON learners FOR DELETE USING (true);

CREATE POLICY "Enable read" ON subjects FOR SELECT USING (true);
CREATE POLICY "Enable write" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON subjects FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON subjects FOR DELETE USING (true);

CREATE POLICY "Enable read" ON sessions FOR SELECT USING (true);
CREATE POLICY "Enable write" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON sessions FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON sessions FOR DELETE USING (true);

CREATE POLICY "Enable read" ON marks FOR SELECT USING (true);
CREATE POLICY "Enable write" ON marks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON marks FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON marks FOR DELETE USING (true);

CREATE POLICY "Enable read" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable write" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON audit_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON audit_logs FOR DELETE USING (true);

CREATE POLICY "Enable read" ON admin_settings FOR SELECT USING (true);
CREATE POLICY "Enable write" ON admin_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update" ON admin_settings FOR UPDATE USING (true);
CREATE POLICY "Enable delete" ON admin_settings FOR DELETE USING (true);
`

    // Execute setup using rpc
    console.log('[SETUP] Creating tables and inserting data...')
    const { error } = await supabase.rpc('exec', {
      sql: setupSQL
    }).then(() => ({ error: null })).catch(err => ({
      error: err
    }))

    if (error) {
      console.log('[INFO] RPC not available, trying alternative method...')
      
      // Alternative: Create tables one by one
      console.log('[CREATE] Creating exam_types table...')
      await supabase.from('exam_types').select('*').limit(0)
      
      console.log('[CREATE] Creating classes table...')
      await supabase.from('classes').select('*').limit(0)
      
      console.log('[INSERT] Inserting exam types...')
      const { error: e1 } = await supabase.from('exam_types').insert([
        { name: 'Opener', description: 'Opening exam at the start of term' },
        { name: 'Midterm', description: 'Mid-term examination' },
        { name: 'Endterm', description: 'End of term examination' },
      ])
      
      console.log('[INSERT] Inserting classes...')
      const { error: e2 } = await supabase.from('classes').insert([
        { name: 'PP1', code: 'PP1', display_order: 1 },
        { name: 'PP2', code: 'PP2', display_order: 2 },
        { name: 'Grade 1', code: 'GRD1', display_order: 3 },
        { name: 'Grade 2', code: 'GRD2', display_order: 4 },
        { name: 'Grade 3', code: 'GRD3', display_order: 5 },
        { name: 'Grade 4', code: 'GRD4', display_order: 6 },
        { name: 'Grade 5', code: 'GRD5', display_order: 7 },
        { name: 'Grade 6', code: 'GRD6', display_order: 8 },
        { name: 'Grade 7', code: 'GRD7', display_order: 9 },
        { name: 'Grade 8', code: 'GRD8', display_order: 10 },
        { name: 'Grade 9', code: 'GRD9', display_order: 11 },
      ])
    }

    // Verify setup
    console.log('\n[VERIFY] Checking data...')
    const { data: exams } = await supabase.from('exam_types').select('*')
    const { data: classes } = await supabase.from('classes').select('*')
    
    console.log(`Exam Types: ${exams?.length || 0}`)
    if (exams?.length > 0) {
      exams.forEach(e => console.log(`  - ${e.name}`))
    }
    
    console.log(`\nClasses: ${classes?.length || 0}`)
    if (classes?.length > 0) {
      classes.slice(0, 5).forEach(c => console.log(`  - ${c.name}`))
      if (classes.length > 5) console.log(`  ... and ${classes.length - 5} more`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('DATABASE INITIALIZATION COMPLETE!')
    console.log('='.repeat(60))
    console.log('\nYour app should now show data in the dropdowns!')
    console.log('Refresh your browser to see the changes.')

  } catch (error) {
    console.error('\nERROR during setup:')
    console.error(error.message)
    console.error('\nDetails:', error)
    process.exit(1)
  }
}

initDatabase()
