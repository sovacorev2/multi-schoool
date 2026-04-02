# School Exam Management System - New School Deployment Guide

## Quick Deployment for a New School

This guide allows you to deploy the exact same exam management system for any school.
Each school gets their own database, their own URL, and their own branding.

---

## STEP 1: Create a New Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `schoolname-exams` (e.g., `sunshine-academy-exams`)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to the school location
5. Click "Create new project" and wait for it to initialize

---

## STEP 2: Run the Database Setup Script

1. In your new Supabase project, go to **SQL Editor**
2. Click **New query**
3. Copy and paste this ENTIRE script:

```sql
-- =====================================================
-- SCHOOL EXAM MANAGEMENT SYSTEM - DATABASE SETUP
-- =====================================================

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  display_order integer DEFAULT 0,
  teacher_name text,
  password text,
  created_at timestamptz DEFAULT now()
);

-- Learners table
CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  admission_number text,
  gender text CHECK (gender IN ('Male', 'Female', 'M', 'F')),
  stream_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- Exam types table
CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Sessions table
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

-- Marks table
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

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id),
  session_id uuid REFERENCES sessions(id),
  action text NOT NULL,
  details jsonb,
  performed_by text,
  created_at timestamptz DEFAULT now()
);

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_learners_class ON learners(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_marks_learner ON marks(learner_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_session ON marks(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_class ON audit_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_streams_class ON streams(class_id);

-- Enable Row Level Security
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all on classes" ON classes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on learners" ON learners FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on subjects" ON subjects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marks" ON marks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on exam_types" ON exam_types FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_logs" ON audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on admin_settings" ON admin_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on streams" ON streams FOR ALL TO anon USING (true) WITH CHECK (true);

-- Insert default exam types
INSERT INTO exam_types (name, description, display_order) VALUES
  ('Opener', 'Opening exam at the start of term', 1),
  ('Midterm', 'Mid-term examination', 2),
  ('Endterm', 'End of term examination', 3)
ON CONFLICT (name) DO NOTHING;

-- Insert default classes (PP1, PP2, Grade 1-9)
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

-- Insert default admin password (change this after setup!)
INSERT INTO admin_settings (key, value) VALUES
  ('admin_password', 'admin123')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

4. Click **Run** to execute the script
5. You should see "Success. No rows returned" - this means it worked!

---

## STEP 3: Get Your Supabase Credentials

1. In your Supabase project, go to **Settings** > **API**
2. Copy these values (you'll need them for Vercel):
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJI...` (the long one)
   - **service_role key**: `eyJhbGciOiJI...` (under "service_role", keep this SECRET!)

---

## STEP 4: Deploy to Vercel

### Option A: From the Same GitHub Repository (Recommended)

1. Go to https://vercel.com/new
2. Import the same repository: `your-username/school-exam-system`
3. Before deploying, click **Environment Variables**
4. Add these variables:

| Variable Name | Value |
|--------------|-------|
| `NEXT_PUBLIC_SCHOOL_NAME` | `Sunshine Academy Primary School` |
| `NEXT_PUBLIC_SCHOOL_SHORT_NAME` | `SAPS` |
| `NEXT_PUBLIC_SCHOOL_TAGLINE` | `Excellence Through Education` |
| `NEXT_PUBLIC_SCHOOL_EMAIL` | `info@sunshineacademy.com` |
| `NEXT_PUBLIC_SCHOOL_PHONE` | `+254 700 000 000` |
| `NEXT_PUBLIC_SCHOOL_ADDRESS` | `123 School Road, City` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` |

5. Click **Deploy**
6. Your new school system will be at: `https://sunshine-academy-exams.vercel.app`

### Option B: Fork the Repository First

1. Go to GitHub and fork the repository to a new name
2. Then import the forked repository to Vercel
3. Add the environment variables as shown above

---

## STEP 5: Upload School Logo

After deployment:
1. Download the school's logo as a PNG file
2. In v0 or your code editor, replace `/public/logo.png` with the new logo
3. Push the change to redeploy

Or set `NEXT_PUBLIC_SCHOOL_LOGO_URL` to an external logo URL.

---

## STEP 6: Initial Setup

1. Go to your new deployment URL
2. Login with admin password: `admin123`
3. Go to **Settings** and change:
   - Admin password (IMPORTANT!)
   - Class passwords for each grade
   - Add teachers' names to classes
4. Add subjects for each class
5. Add students (learners) to each class

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SCHOOL_NAME` | Full school name | Yes |
| `NEXT_PUBLIC_SCHOOL_SHORT_NAME` | Short name/acronym | Yes |
| `NEXT_PUBLIC_SCHOOL_TAGLINE` | School motto | No |
| `NEXT_PUBLIC_SCHOOL_EMAIL` | Contact email | No |
| `NEXT_PUBLIC_SCHOOL_PHONE` | Contact phone | No |
| `NEXT_PUBLIC_SCHOOL_ADDRESS` | Physical address | No |
| `NEXT_PUBLIC_SCHOOL_PRIMARY_COLOR` | Brand color (hex) | No |
| `NEXT_PUBLIC_SCHOOL_LOGO_URL` | External logo URL | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Yes |

---

## Troubleshooting

### "Connection refused" or "Database error"
- Check that Supabase credentials are correct
- Make sure the SQL script ran successfully

### School name not updating
- Clear browser cache
- Check environment variables are spelled correctly
- Redeploy after changing variables

### Logo not showing
- Make sure logo.png is in /public folder
- Or set NEXT_PUBLIC_SCHOOL_LOGO_URL to external URL

---

## Support

For technical support or customizations, contact the developer.

---

*This deployment guide was auto-generated for the School Exam Management System.*
