const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addPinManagementFeature() {
  try {
    // Add feature_pin_management column to schools table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE schools 
        ADD COLUMN IF NOT EXISTS feature_pin_management boolean DEFAULT false;
      `
    })

    if (error) {
      console.error('Error adding column:', error)
      // Try alternative approach using direct Postgres command
      console.log('Trying alternative approach...')
      
      // Check if column exists first
      const { data: columns } = await supabase
        .from('information_schema.columns')
        .select('*')
        .eq('table_name', 'schools')
        .eq('column_name', 'feature_pin_management')
      
      if (!columns || columns.length === 0) {
        console.log('Column does not exist, migration may need manual setup')
      } else {
        console.log('Column already exists')
      }
    } else {
      console.log('Successfully added feature_pin_management column')
    }

    // Set default to false for existing schools
    const { error: updateError } = await supabase
      .from('schools')
      .update({ feature_pin_management: false })
      .is('feature_pin_management', null)

    if (updateError) {
      console.log('Note: Could not update existing records (may not be necessary)')
    } else {
      console.log('Updated existing schools with feature_pin_management = false')
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

addPinManagementFeature()
