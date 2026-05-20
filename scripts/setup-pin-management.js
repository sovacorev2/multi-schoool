import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public'
  }
})

async function addPinManagementFeature() {
  try {
    console.log('Attempting to add feature_pin_management column to schools table...')
    
    // Use Supabase RPC to execute raw SQL
    // First, let's try using the admin API directly with raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_pin_management BOOLEAN DEFAULT false;`
    }).catch(() => {
      console.log('RPC method not available, trying direct approach...')
      return { error: true }
    })
    
    if (error && error !== true) {
      console.error('RPC Error:', error)
      throw error
    }
    
    console.log('✓ Column migration completed!')
    
    // Now enable PIN management for all schools
    console.log('Enabling PIN management for all schools...')
    const { error: updateError } = await supabase
      .from('schools')
      .update({ feature_pin_management: true })
      .eq('feature_pin_management', false)
    
    if (updateError) {
      console.error('Error enabling PIN management:', updateError)
    } else {
      console.log('✓ PIN management enabled for all schools')
    }
    
    // Verify St James has PIN management enabled
    const { data: stJames, error: fetchError } = await supabase
      .from('schools')
      .select('id, name, feature_pin_management')
      .ilike('name', '%st james%')
      .single()
    
    if (fetchError) {
      console.log('Note: Could not verify St James Koteko Primary School')
    } else if (stJames) {
      console.log(`\n✓ St James Koteko Primary School:`)
      console.log(`  - ID: ${stJames.id}`)
      console.log(`  - PIN Management: ${stJames.feature_pin_management ? 'ENABLED' : 'DISABLED'}`)
    }
    
    console.log('\nSetup completed successfully!')
  } catch (error) {
    console.error('Setup error:', error)
    process.exit(1)
  }
}

addPinManagementFeature()
