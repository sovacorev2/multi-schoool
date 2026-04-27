import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('/vercel/share/.env.project', 'utf-8')
const envLines = envContent.split('\n')
let url, serviceKey, anonKey

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    anonKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

console.log('[DEBUG] Testing with service role key...')
const supabaseService = createClient(url, serviceKey)

try {
  const { data: exams, error: examsError } = await supabaseService
    .from('exam_types')
    .select('*')

  console.log('[EXAM_TYPES]')
  console.log('Error:', examsError)
  console.log('Count:', exams?.length)
  if (exams?.length > 0) {
    console.log('Sample:', exams[0])
  }
} catch (e) {
  console.log('Exception:', e.message)
}

try {
  const { data: classes, error: classesError } = await supabaseService
    .from('classes')
    .select('*')

  console.log('\n[CLASSES]')
  console.log('Error:', classesError)
  console.log('Count:', classes?.length)
  if (classes?.length > 0) {
    console.log('Sample:', classes[0].name)
  }
} catch (e) {
  console.log('Exception:', e.message)
}

// Try with anon key
console.log('\n[DEBUG] Testing with anon key...')
const supabaseAnon = createClient(url, anonKey)

try {
  const { data: exams2 } = await supabaseAnon
    .from('exam_types')
    .select('*')
  console.log('Anon result:', exams2?.length || 0)
} catch (e) {
  console.log('Exception:', e.message)
}
