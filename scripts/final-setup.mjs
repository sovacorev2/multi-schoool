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

console.log('[SETUP] Starting database initialization...')
console.log('[SETUP] URL:', url.substring(0, 30) + '...')

const supabase = createClient(url, serviceKey)

async function setupDatabase() {
  try {
    // 1. Insert exam types
    console.log('[SETUP] Inserting exam types...')
    const examTypes = [
      { name: 'Opener', description: 'Opening exam at the start of term' },
      { name: 'Midterm', description: 'Mid-term examination' },
      { name: 'Endterm', description: 'End of term examination' },
    ]
    
    for (const exam of examTypes) {
      await supabase.from('exam_types').insert([exam])
    }
    console.log('✓ Exam types inserted')

    // 2. Insert classes
    console.log('[SETUP] Inserting classes...')
    const classes = [
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
    ]
    
    for (const cls of classes) {
      await supabase.from('classes').insert([cls])
    }
    console.log('✓ Classes inserted')

    // 3. Insert admin settings
    console.log('[SETUP] Setting admin password...')
    await supabase.from('admin_settings').insert([
      { key: 'admin_password', value: 'admin123' }
    ])
    console.log('✓ Admin settings inserted')

    // 4. Verify data
    console.log('[SETUP] Verifying data...')
    const { data: exams } = await supabase.from('exam_types').select('*')
    const { data: cls } = await supabase.from('classes').select('*')
    
    console.log('\n✓ DATABASE SETUP COMPLETE!')
    console.log(`  - Exam Types: ${exams?.length || 0}`)
    console.log(`  - Classes: ${cls?.length || 0}`)
    console.log('\nYour dropdowns should now work!')
    
  } catch (error) {
    console.error('✗ Setup failed:', error.message)
    process.exit(1)
  }
}

setupDatabase()
