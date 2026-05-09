const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[v0] Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupTables() {
  console.log('[v0] Creating school_subjects table...')

  try {
    const { data, error } = await supabase.rpc('execute', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.school_subjects (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
          name text NOT NULL,
          code text NOT NULL,
          is_enabled boolean DEFAULT true,
          created_at timestamp DEFAULT now(),
          UNIQUE(school_id, code)
        );

        CREATE INDEX IF NOT EXISTS idx_school_subjects_school ON public.school_subjects(school_id);
        CREATE INDEX IF NOT EXISTS idx_school_subjects_enabled ON public.school_subjects(school_id, is_enabled);

        CREATE TABLE IF NOT EXISTS public.class_enabled_subjects (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
          subject_code text NOT NULL,
          created_at timestamp DEFAULT now(),
          UNIQUE(class_id, subject_code)
        );

        CREATE INDEX IF NOT EXISTS idx_class_enabled_subjects_class ON public.class_enabled_subjects(class_id);
      `
    })

    console.log('[v0] Table setup complete')
  } catch (error) {
    console.log('[v0] Tables may already exist:', error.message)
  }
}

setupTables()
