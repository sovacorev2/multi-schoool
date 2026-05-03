// This script updates school logos in the database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateLogos() {
  try {
    console.log('Updating school logos...');
    
    // Get all schools first to see current state
    const { data: schools, error: fetchError } = await supabase
      .from('schools')
      .select('id, name, logo_url');
    
    if (fetchError) throw fetchError;
    
    console.log('Current schools:');
    schools.forEach(s => console.log(`  - ${s.name}: ${s.logo_url || 'NO LOGO'}`));
    
    // Update Amagoro logo
    const { error: amagoroError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/amagoro-logo.jpeg' })
      .eq('name', 'AMAGORO COMPREHENSIVE SCHOOL');
    
    if (amagoroError) throw amagoroError;
    console.log('✓ Updated Amagoro logo');
    
    // Verify updates
    const { data: updated } = await supabase
      .from('schools')
      .select('id, name, logo_url')
      .in('name', ['AMAGORO COMPREHENSIVE SCHOOL', 'Shule Tech']);
    
    console.log('\nUpdated schools:');
    updated?.forEach(s => console.log(`  - ${s.name}: ${s.logo_url || 'NO LOGO'}`));
    
    console.log('✓ Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateLogos();
