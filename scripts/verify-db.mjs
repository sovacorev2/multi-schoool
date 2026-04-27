import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('/vercel/share/.env.project', 'utf-8')
const envLines = envContent.split('\n')
let url, key

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    key = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

const supabase = createClient(url, key)

async function verify() {
  try {
    console.log('[DB] Checking classes...')
    const { data: classes, error: e1 } = await supabase.from('classes').select('*')
    console.log('✓ Classes:', classes?.length || 0)
    if (classes?.length > 0) {
      classes.slice(0, 3).forEach(c => console.log(`   - ${c.name}`))
    }

    console.log('\n[DB] Checking exam_types...')
    const { data: exams, error: e2 } = await supabase.from('exam_types').select('*')
    console.log('✓ Exam Types:', exams?.length || 0)
    if (exams?.length > 0) {
      exams.forEach(e => console.log(`   - ${e.name}`))
    }

    if (!classes || classes.length === 0 || !exams || exams.length === 0) {
      console.log('\n⚠️  Database is empty! Need to run setup.')
      process.exit(1)
    }
    console.log('\n✓ Database is ready!')
  } catch (e) {
    console.log('✗ Connection failed:', e.message)
    process.exit(1)
  }
}

verify()
