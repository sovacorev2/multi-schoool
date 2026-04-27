import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

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

const supabase = createClient(url, serviceKey)

async function setupDB() {
  console.log('[CREATE TABLES] Starting...\n')
  
  const sqlScript = `
-- Create exam_types table
CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  display_order integer DEFAULT 0,
  teacher_name text,
  password text,
  created_at timestamptz DEFAULT now()
);

-- Insert exam types
INSERT INTO exam_types (name, description, display_order) VALUES
  ('Opener', 'Opening exam at the start of term', 1),
  ('Midterm', 'Mid-term examination', 2),
  ('Endterm', 'End of term examination', 3)
ON CONFLICT (name) DO NOTHING;

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
  ('Grade 9', 'GRD9', 11)
ON CONFLICT (code) DO NOTHING;

-- Enable RLS
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access" ON exam_types FOR SELECT USING (true);
CREATE POLICY "Enable read access" ON classes FOR SELECT USING (true);
CREATE POLICY "Enable insert" ON exam_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert" ON classes FOR INSERT WITH CHECK (true);
  `

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: sqlScript })
    
    if (error) {
      console.log('[INFO] RPC method not available, trying direct queries...')
      
      // Try direct table creation
      const { error: e1 } = await supabase.from('exam_types').select('*').limit(0)
      if (e1 && e1.code === 'PGRST116') {
        console.log('⚠️  exam_types table does not exist')
      } else {
        console.log('✓ exam_types table exists')
      }
      
      const { error: e2 } = await supabase.from('classes').select('*').limit(0)
      if (e2 && e2.code === 'PGRST116') {
        console.log('⚠️  classes table does not exist')
      } else {
        console.log('✓ classes table exists')
      }
      
      // Insert data
      console.log('\n[INSERT] Adding data...')
      const { error: ie1 } = await supabase.from('exam_types').insert([
        { name: 'Opener', description: 'Opening exam at the start of term' },
        { name: 'Midterm', description: 'Mid-term examination' },
        { name: 'Endterm', description: 'End of term examination' },
      ])
      
      if (!ie1) {
        console.log('✓ Exam types inserted')
      } else {
        console.log('✗ Error inserting exam types:', ie1.message)
      }
      
      const { error: ie2 } = await supabase.from('classes').insert([
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
      
      if (!ie2) {
        console.log('✓ Classes inserted')
      } else {
        console.log('✗ Error inserting classes:', ie2.message)
      }
    } else {
      console.log('✓ Database setup executed via RPC')
    }
    
    // Final verification
    console.log('\n[VERIFY] Checking data...')
    const { data: exams } = await supabase.from('exam_types').select('*')
    const { data: cls } = await supabase.from('classes').select('*')
    console.log(`Exam Types: ${exams?.length || 0}`)
    console.log(`Classes: ${cls?.length || 0}`)
    
    console.log('\n✓ Setup complete! Refresh your app.')
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

setupDB()
