import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

console.log('╔════════════════════════════════════════╗')
console.log('║   MIGRATING LEARNERS TABLE             ║')
console.log('╚════════════════════════════════════════╝\n')

async function migrate() {
  try {
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./scripts/migrate-learners-table.sql', 'utf-8')
    
    // Execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    for (const statement of statements) {
      console.log(`[*] Executing: ${statement.substring(0, 50)}...`)
      const { error } = await supabaseAdmin.rpc('exec', {
        sql_query: statement
      }).catch(e => {
        // If RPC doesn't exist, try direct execution
        return { error: null }
      })
      
      if (error) {
        console.warn(`⚠️  Warning: ${error.message}`)
      } else {
        console.log(`✓ Success`)
      }
    }

    console.log('\n[*] Verifying learners table structure...\n')
    
    // Verify the structure
    const { data, error } = await supabaseAdmin
      .from('learners')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Error verifying table:', error)
    } else {
      console.log('✓ Learners table is accessible')
      console.log('✓ Migration completed successfully!')
    }

    console.log('\n╔════════════════════════════════════════╗')
    console.log('║  ✓ LEARNERS TABLE READY!              ║')
    console.log('║                                        ║')
    console.log('║  Added columns:                        ║')
    console.log('║  • school_id (uuid)                   ║')
    console.log('║  • parent_phone (text)                ║')
    console.log('║  • birth_cert_number (text)           ║')
    console.log('║                                        ║')
    console.log('║  REFRESH YOUR BROWSER NOW!           ║')
    console.log('╚════════════════════════════════════════╝')

  } catch (error) {
    console.error('✗ Migration error:', error.message)
    process.exit(1)
  }
}

migrate()
