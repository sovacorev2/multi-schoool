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

async function verify() {
  try {
    console.log('[VERIFY] Checking database...\n')
    
    const { data: exams, error: e1 } = await supabase
      .from('exam_types')
      .select('*')
    console.log(`Exam Types: ${exams?.length || 0}`)
    if (exams && exams.length > 0) {
      exams.forEach(e => console.log(`  - ${e.name}`))
    } else {
      console.log('  ⚠️  Empty! Inserting...')
      const { error } = await supabase.from('exam_types').upsert([
        { name: 'Opener', description: 'Opening exam at the start of term' },
        { name: 'Midterm', description: 'Mid-term examination' },
        { name: 'Endterm', description: 'End of term examination' },
      ], { onConflict: 'name' })
      if (!error) {
        const { data: updated } = await supabase.from('exam_types').select('*')
        console.log(`  ✓ Inserted! Now: ${updated?.length || 0}`)
      }
    }
    
    console.log()
    const { data: classes } = await supabase
      .from('classes')
      .select('*')
      .order('display_order')
    console.log(`Classes: ${classes?.length || 0}`)
    if (classes && classes.length > 0) {
      classes.slice(0, 3).forEach(c => console.log(`  - ${c.name}`))
      if (classes.length > 3) console.log(`  ... and ${classes.length - 3} more`)
    } else {
      console.log('  ⚠️  Empty! Inserting...')
      const classData = [
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
      const { error } = await supabase.from('classes').upsert(classData, { onConflict: 'code' })
      if (!error) {
        const { data: updated } = await supabase.from('classes').select('*').order('display_order')
        console.log(`  ✓ Inserted! Now: ${updated?.length || 0}`)
      }
    }
    
    console.log('\n✓ Database verification complete!')
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

verify()
