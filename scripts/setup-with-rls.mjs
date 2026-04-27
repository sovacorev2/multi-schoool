import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('/vercel/share/.env.project', 'utf-8')
const envLines = envContent.split('\n')
let supabaseUrl, supabaseAnonKey, supabaseServiceKey

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseServiceKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

// Use service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// Use anon key for user operations
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)

console.log('╔════════════════════════════════════════╗')
console.log('║   DATABASE SETUP WITH RLS CONFIG       ║')
console.log('╚════════════════════════════════════════╝\n')

async function clearAndInsertData() {
  console.log('[1/3] Clearing existing data...\n')
  
  try {
    // Clear exam_types
    const { error: delExams } = await supabaseAdmin
      .from('exam_types')
      .delete()
      .neq('id', 'null')
    
    if (!delExams) console.log('✓ Cleared exam_types')
    
    // Clear classes
    const { error: delClasses } = await supabaseAdmin
      .from('classes')
      .delete()
      .neq('id', 'null')
    
    if (!delClasses) console.log('✓ Cleared classes')
    
    // Clear admin_settings
    const { error: delSettings } = await supabaseAdmin
      .from('admin_settings')
      .delete()
      .neq('id', 'null')
    
    if (!delSettings) console.log('✓ Cleared admin_settings')

    console.log('\n[2/3] Inserting fresh data...\n')

    // Insert exam types
    const examTypes = [
      { name: 'Opener', description: 'Opening exam at the start of term', display_order: 1 },
      { name: 'Midterm', description: 'Mid-term examination', display_order: 2 },
      { name: 'Endterm', description: 'End of term examination', display_order: 3 },
    ]

    const { error: e1 } = await supabaseAdmin
      .from('exam_types')
      .insert(examTypes)

    if (!e1) {
      console.log('✓ Inserted 3 exam types')
    } else {
      console.log('⚠ Error inserting exam types (may already exist):', e1.message)
    }

    // Insert classes
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

    const { error: e2 } = await supabaseAdmin
      .from('classes')
      .insert(classes)

    if (!e2) {
      console.log('✓ Inserted 11 classes')
    } else {
      console.log('⚠ Error inserting classes (may already exist):', e2.message)
    }

    // Insert admin settings
    const { error: e3 } = await supabaseAdmin
      .from('admin_settings')
      .insert([{ key: 'admin_password', value: 'admin123' }])

    if (!e3) {
      console.log('✓ Set admin password')
    } else {
      console.log('⚠ Error setting admin password:', e3.message)
    }

    console.log('\n[3/3] Verifying data...\n')

    // Verify with anon key (respects RLS)
    const { data: exams, error: ve1 } = await supabaseAnon
      .from('exam_types')
      .select('*')
      .order('display_order')

    const { data: classData, error: ve2 } = await supabaseAnon
      .from('classes')
      .select('*')
      .order('display_order')

    const { data: settings, error: ve3 } = await supabaseAnon
      .from('admin_settings')
      .select('*')

    console.log(`Exam Types: ${exams?.length || 0}`)
    if (exams && exams.length > 0) {
      exams.forEach(e => console.log(`  • ${e.name}`))
    }

    console.log(`\nClasses: ${classData?.length || 0}`)
    if (classData && classData.length > 0) {
      classData.slice(0, 5).forEach(c => console.log(`  • ${c.name}`))
      if (classData.length > 5) console.log(`  ... and ${classData.length - 5} more`)
    }

    console.log(`\nAdmin Settings: ${settings?.length || 0}`)

    const success = (exams?.length === 3 && classData?.length === 11)

    console.log('\n╔════════════════════════════════════════╗')
    if (success) {
      console.log('║  ✓ DATABASE READY!                     ║')
      console.log('║                                        ║')
      console.log('║  Your dropdowns are now populated:    ║')
      console.log('║  • 3 Exam Types (Opener, Midterm...) ║')
      console.log('║  • 11 Classes (PP1-Grade 9)          ║')
      console.log('║  • Admin password: admin123           ║')
      console.log('║                                        ║')
      console.log('║  REFRESH YOUR BROWSER NOW!           ║')
    } else {
      console.log('║  ⚠ VERIFICATION FAILED                ║')
      console.log('║  Data may not be accessible           ║')
    }
    console.log('╚════════════════════════════════════════╝')

    return success
  } catch (error) {
    console.error('✗ Setup error:', error.message)
    return false
  }
}

clearAndInsertData()
