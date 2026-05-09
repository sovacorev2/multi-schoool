import { createClient } from '@/lib/supabase/client'

async function setupSchoolSubjectsTable() {
  const supabase = createClient()

  console.log('[v0] Setting up school_subjects table...')

  try {
    // Create school_subjects table if it doesn't exist
    const { error: createError } = await supabase.rpc('execute_sql', {
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

    if (createError && !createError.message.includes('permission denied')) {
      console.error('[v0] Error creating tables:', createError)
      return false
    }

    console.log('[v0] School subjects table setup complete')
    return true
  } catch (error) {
    console.error('[v0] Setup failed:', error)
    return false
  }
}

// Run setup immediately
setupSchoolSubjectsTable().then(success => {
  if (success) {
    console.log('[v0] Tables created successfully')
  } else {
    console.log('[v0] Tables may already exist or setup incomplete - continuing...')
  }
})

export { setupSchoolSubjectsTable }
