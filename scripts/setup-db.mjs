import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read env file manually
const envPath = process.env.ENV_FILE || '/vercel/share/.env.project'
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envLines = envContent.split('\n')
    console.log(`[DEBUG] Read env file from: ${envPath}`)
    for (const line of envLines) {
      if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        let val = line.replace('NEXT_PUBLIC_SUPABASE_URL=', '').trim()
        val = val.replace(/^'|'$/g, '').replace(/^"|"$/g, '')
        supabaseUrl = val
        console.log(`[DEBUG] Found URL: ${supabaseUrl.substring(0, 30)}...`)
      }
      if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        let val = line.replace('SUPABASE_SERVICE_ROLE_KEY=', '').trim()
        val = val.replace(/^'|'$/g, '').replace(/^"|"$/g, '')
        supabaseServiceKey = val
        console.log(`[DEBUG] Found KEY: ${supabaseServiceKey.substring(0, 20)}...`)
      }
    }
  } catch (err) {
    console.error('❌ Could not read env file:', err.message)
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('   URL:', supabaseUrl ? `✓ (${supabaseUrl.substring(0, 30)}...)` : '✗')
  console.error('   KEY:', supabaseServiceKey ? `✓` : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setup() {
  try {
    console.log('🔄 Setting up database...')
    
    console.log('✅ Creating exam types...')
    const { error: examError } = await supabase.from('exam_types').upsert([
      { name: 'Opener', description: 'Opening exam at the start of term', display_order: 1 },
      { name: 'Midterm', description: 'Mid-term examination', display_order: 2 },
      { name: 'Endterm', description: 'End of term examination', display_order: 3 }
    ], { onConflict: 'name' })
    
    if (examError) throw examError

    console.log('✅ Creating classes...')
    const { error: classError } = await supabase.from('classes').upsert([
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
      { name: 'Grade 9', code: 'GRD9', display_order: 11 }
    ], { onConflict: 'code' })
    
    if (classError) throw classError

    console.log('✅ Setting admin password...')
    const { error: settingError } = await supabase.from('admin_settings').upsert([
      { key: 'admin_password', value: 'admin123' }
    ], { onConflict: 'key' })
    
    if (settingError) throw settingError

    console.log('\n✨ Database setup complete!')
    console.log('✅ Exam types: Opener, Midterm, Endterm')
    console.log('✅ Classes: PP1-PP2, Grade 1-9')
    console.log('✅ Admin password: admin123')
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error('Details:', err)
    process.exit(1)
  }
}

setup()
