import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function updateSchoolLogos() {
  try {
    console.log('Updating school logos...')

    // Update Amagoro
    const { error: amagoroError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/amagoro-logo.jpeg' })
      .ilike('name', '%amagoro%')

    if (amagoroError) {
      console.error('Amagoro update error:', amagoroError)
    } else {
      console.log('✓ Amagoro logo updated to /logos/amagoro-logo.jpeg')
    }

    // Update ShuleTech
    const { error: shuletechError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/shuletech-logo.png' })
      .ilike('name', '%shule%')

    if (shuletechError) {
      console.error('ShuleTech update error:', shuletechError)
    } else {
      console.log('✓ ShuleTech logo updated to /logos/shuletech-logo.png')
    }

    // Verify updates
    const { data } = await supabase
      .from('schools')
      .select('name, logo_url')

    console.log('\nSchools after update:')
    data?.forEach(school => {
      console.log(`  ${school.name}: ${school.logo_url}`)
    })

  } catch (error) {
    console.error('Error:', error)
  }
}

updateSchoolLogos()
