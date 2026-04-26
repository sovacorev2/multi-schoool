import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const setupSQL = `
-- CREATE TABLES
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  display_order integer DEFAULT 0,
  teacher_name text,
  password text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  admission_number text,
  gender text CHECK (gender IN ('Male', 'Female', 'M', 'F')),
  stream_id uuid REFERENCES streams(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
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

CREATE TABLE IF NOT EXISTS marks (
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id),
  session_id uuid REFERENCES sessions(id),
  action text NOT NULL,
  details jsonb,
  performed_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INSERT DEFAULT DATA
INSERT INTO exam_types (name, description, display_order) VALUES
  ('Opener', 'Opening exam at the start of term', 1),
  ('Midterm', 'Mid-term examination', 2),
  ('Endterm', 'End of term examination', 3)
ON CONFLICT (name) DO NOTHING;

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

INSERT INTO admin_settings (key, value) VALUES
  ('admin_password', 'admin123')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Allow all on classes" ON classes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on learners" ON learners FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on subjects" ON subjects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marks" ON marks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on exam_types" ON exam_types FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_logs" ON audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on admin_settings" ON admin_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on streams" ON streams FOR ALL TO anon USING (true) WITH CHECK (true);
`;

async function setupDatabase() {
  try {
    console.log('Starting database setup...');
    
    const { data, error } = await supabase.rpc('exec', {
      sql: setupSQL
    });

    if (error) {
      console.error('Error executing setup:', error);
      return false;
    }

    console.log('✅ Database setup completed successfully!');
    console.log('✅ Tables created');
    console.log('✅ Default data inserted');
    console.log('✅ Security policies enabled');
    return true;
  } catch (err) {
    console.error('Fatal error:', err);
    return false;
  }
}

setupDatabase().then(success => {
  process.exit(success ? 0 : 1);
});
