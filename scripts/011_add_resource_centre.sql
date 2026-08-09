-- Resource Centre: a global (not per-school) library of exams, marking
-- schemes, schemes of work, CBC projects, and other teaching resources.
-- Managed centrally from super-admin, visible in a school's admin-portal
-- only when that school's feature_exam_hub toggle (added in
-- scripts/010_add_feature_toggles.sql) is on.
--
-- No school_id here deliberately - unlike everything else in this app,
-- resources aren't owned by one school, they're shared content every
-- enabled school can browse. class_level and subject are plain text, not
-- foreign keys into any school's classes/subjects tables, since those
-- differ per school and this library isn't tied to one school's data.
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('exam', 'marking_scheme', 'scheme_of_work', 'cbc_project', 'other')),
  title text NOT NULL,
  description text,
  class_level text,
  subject text,
  term text,
  file_data_url text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL DEFAULT 0,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_class ON resources(class_level);

-- Matches every other table in this app - read/written directly from the
-- browser via the publishable/anon key with no Supabase Auth session (the
-- super-admin side of this is already gated by its own password screen;
-- writes there also go through a service-role API route for the file
-- upload itself, but deletes and the read/browse side use the anon key
-- directly, same as everywhere else).
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
