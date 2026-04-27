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

async function initDatabase() {
  try {
    console.log('[INIT] Starting database initialization...\n')

    // Insert exam types
    console.log('[INIT] Inserting exam types...')
    const examTypes = [
      { name: 'Opener', description: 'Opening exam at the start of term' },
      { name: 'Midterm', description: 'Mid-term examination' },
      { name: 'Endterm', description: 'End of term examination' },
    ]
    
    for (const exam of examTypes) {
      const { error } = await supabase
        .from('exam_types')
        .insert([exam])
        .select()
      // Ignore unique constraint violations
      if (error && error.code !== '23505') {
        console.error(`✗ Error inserting ${exam.name}:`, error.message)
      }
    }
    console.log('✓ Exam types verified')

    // Insert classes
    console.log('[INIT] Inserting classes...')
    const classData = [
      { name: 'PP1', code: 'PP1', password: 'pp1' },
      { name: 'PP2', code: 'PP2', password: 'pp2' },
      { name: 'Grade 1', code: 'GRD1', password: 'gr1' },
      { name: 'Grade 2', code: 'GRD2', password: 'gr2' },
      { name: 'Grade 3', code: 'GRD3', password: 'gr3' },
      { name: 'Grade 4', code: 'GRD4', password: 'gr4' },
      { name: 'Grade 5', code: 'GRD5', password: 'gr5' },
      { name: 'Grade 6', code: 'GRD6', password: 'gr6' },
      { name: 'Grade 7', code: 'GRD7', password: 'gr7' },
      { name: 'Grade 8', code: 'GRD8', password: 'gr8' },
      { name: 'Grade 9', code: 'GRD9', password: 'gr9' },
    ]

    for (const classItem of classData) {
      const { error } = await supabase
        .from('classes')
        .insert([classItem])
        .select()
      if (error && error.code !== '23505') { // 23505 is unique constraint violation
        console.error(`✗ Error inserting ${classItem.name}:`, error.message)
      }
    }
    console.log('✓ Classes inserted/verified')

    // Verify data
    console.log('\n[INIT] Verifying setup...')
    const { data: classes } = await supabase.from('classes').select('*')
    const { data: exams } = await supabase.from('exam_types').select('*')
    
    console.log(`✓ Classes in database: ${classes?.length || 0}`)
    console.log(`✓ Exam types in database: ${exams?.length || 0}`)

    if ((classes?.length || 0) > 0 && (exams?.length || 0) > 0) {
      console.log('\n✅ Database initialization COMPLETE!')
      console.log('\nYour system now has:')
      console.log('  - 11 classes (PP1, PP2, Grade 1-9)')
      console.log('  - 3 exam types (Opener, Midterm, Endterm)')
    } else {
      console.log('\n⚠️  Database may be incomplete')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Initialization failed:', error.message)
    process.exit(1)
  }
}

initDatabase()
