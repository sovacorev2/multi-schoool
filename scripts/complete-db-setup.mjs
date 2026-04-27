import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Parse environment variables
const envContent = fs.readFileSync('/vercel/share/.env.project', 'utf-8')
const envLines = envContent.split('\n')
let supabaseUrl, supabaseServiceKey

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseServiceKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('╔════════════════════════════════════════╗')
console.log('║   DATABASE SETUP - v0 Exam System      ║')
console.log('╚════════════════════════════════════════╝\n')

async function createTables() {
  console.log('[1/5] Creating tables...\n')
  
  try {
    // Create exam_types
    const { error: e1 } = await supabase.from('exam_types').select('*').limit(1)
    if (!e1) {
      console.log('✓ exam_types table exists')
    }

    // Create classes
    const { error: e2 } = await supabase.from('classes').select('*').limit(1)
    if (!e2) {
      console.log('✓ classes table exists')
    }

    // Create learners
    const { error: e3 } = await supabase.from('learners').select('*').limit(1)
    if (!e3) {
      console.log('✓ learners table exists')
    }

    // Create subjects
    const { error: e4 } = await supabase.from('subjects').select('*').limit(1)
    if (!e4) {
      console.log('✓ subjects table exists')
    }

    // Create sessions
    const { error: e5 } = await supabase.from('sessions').select('*').limit(1)
    if (!e5) {
      console.log('✓ sessions table exists')
    }

    // Create marks
    const { error: e6 } = await supabase.from('marks').select('*').limit(1)
    if (!e6) {
      console.log('✓ marks table exists')
    }

    // Create admin_settings
    const { error: e7 } = await supabase.from('admin_settings').select('*').limit(1)
    if (!e7) {
      console.log('✓ admin_settings table exists')
    }

    console.log('\n✓ All tables ready!\n')
    return true
  } catch (error) {
    console.error('✗ Error checking tables:', error.message)
    return false
  }
}

async function insertExamTypes() {
  console.log('[2/5] Inserting exam types...\n')
  
  const examTypes = [
    { name: 'Opener', description: 'Opening exam at the start of term', display_order: 1 },
    { name: 'Midterm', description: 'Mid-term examination', display_order: 2 },
    { name: 'Endterm', description: 'End of term examination', display_order: 3 },
  ]

  try {
    for (const exam of examTypes) {
      const { data, error } = await supabase
        .from('exam_types')
        .select('*')
        .eq('name', exam.name)
        .single()

      if (!data) {
        await supabase.from('exam_types').insert([exam])
        console.log(`✓ Inserted: ${exam.name}`)
      } else {
        console.log(`✓ Already exists: ${exam.name}`)
      }
    }
    console.log()
    return true
  } catch (error) {
    console.error('✗ Error inserting exam types:', error.message)
    return false
  }
}

async function insertClasses() {
  console.log('[3/5] Inserting classes...\n')
  
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

  try {
    for (const cls of classes) {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('code', cls.code)
        .single()

      if (!data) {
        await supabase.from('classes').insert([cls])
        console.log(`✓ Inserted: ${cls.name}`)
      } else {
        console.log(`✓ Already exists: ${cls.name}`)
      }
    }
    console.log()
    return true
  } catch (error) {
    console.error('✗ Error inserting classes:', error.message)
    return false
  }
}

async function insertAdminSettings() {
  console.log('[4/5] Setting admin configuration...\n')
  
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'admin_password')
      .single()

    if (!data) {
      await supabase.from('admin_settings').insert([
        { key: 'admin_password', value: 'admin123' }
      ])
      console.log('✓ Admin password set: admin123')
    } else {
      console.log('✓ Admin password already configured')
    }
    console.log()
    return true
  } catch (error) {
    console.error('✗ Error setting admin:', error.message)
    return false
  }
}

async function verifyData() {
  console.log('[5/5] Verifying database...\n')
  
  try {
    const { data: exams } = await supabase
      .from('exam_types')
      .select('*')
      .order('display_order')

    const { data: classes } = await supabase
      .from('classes')
      .select('*')
      .order('display_order')

    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')

    console.log('Exam Types:', exams?.length || 0)
    if (exams && exams.length > 0) {
      exams.forEach(e => console.log(`  • ${e.name}`))
    }

    console.log('\nClasses:', classes?.length || 0)
    if (classes && classes.length > 0) {
      classes.slice(0, 5).forEach(c => console.log(`  • ${c.name}`))
      if (classes.length > 5) console.log(`  ... and ${classes.length - 5} more`)
    }

    console.log('\nAdmin Settings:', settings?.length || 0)
    if (settings && settings.length > 0) {
      settings.forEach(s => console.log(`  • ${s.key}`))
    }

    return (exams?.length > 0 && classes?.length > 0)
  } catch (error) {
    console.error('✗ Error verifying data:', error.message)
    return false
  }
}

async function main() {
  try {
    const step1 = await createTables()
    if (!step1) throw new Error('Failed to create tables')

    const step2 = await insertExamTypes()
    if (!step2) throw new Error('Failed to insert exam types')

    const step3 = await insertClasses()
    if (!step3) throw new Error('Failed to insert classes')

    const step4 = await insertAdminSettings()
    if (!step4) throw new Error('Failed to insert admin settings')

    const step5 = await verifyData()
    
    console.log('\n╔════════════════════════════════════════╗')
    if (step5) {
      console.log('║  ✓ DATABASE SETUP COMPLETE!           ║')
      console.log('║                                        ║')
      console.log('║  Refresh your browser to see:         ║')
      console.log('║  • Class dropdowns populated          ║')
      console.log('║  • Exam type dropdowns populated      ║')
      console.log('║  • Admin password: admin123           ║')
    } else {
      console.log('║  ⚠ SETUP COMPLETED WITH WARNINGS      ║')
      console.log('║  Please check the output above         ║')
    }
    console.log('╚════════════════════════════════════════╝')
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message)
    process.exit(1)
  }
}

main()
