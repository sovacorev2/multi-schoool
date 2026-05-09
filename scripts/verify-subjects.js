import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifySubjects() {
  console.log('[v0] Checking subjects in database...')

  // Get all schools
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .limit(3)

  console.log('[v0] Schools:', schools)

  if (schools && schools.length > 0) {
    for (const school of schools) {
      console.log(`\n[v0] Checking subjects for school: ${school.name} (${school.id})`)
      
      const { data: subjects, error } = await supabase
        .from('subjects')
        .select('id, name, code, is_disabled')
        .eq('school_id', school.id)

      if (error) {
        console.error('[v0] Error:', error)
      } else {
        console.log(`[v0] Found ${subjects?.length || 0} subjects`)
        console.log('[v0] Enabled subjects:', subjects?.filter(s => !s.is_disabled).map(s => s.code).join(', '))
        console.log('[v0] Disabled subjects:', subjects?.filter(s => s.is_disabled).map(s => s.code).join(', '))
      }
    }
  }

  process.exit(0)
}

verifySubjects().catch(err => {
  console.error('[v0] Error:', err)
  process.exit(1)
})
