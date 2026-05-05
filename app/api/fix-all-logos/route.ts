import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Update St Michael's logo with the blob URL
    const { data: stmichael, error } = await supabase
      .from('schools')
      .update({ 
        logo_url: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/stmichaellogo-uFafBc9amB4gT3cJroyU531usCnSy8.jpeg'
      })
      .ilike('name', '%st michael%')
      .select()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Also update Amagoro and ShuleTech if needed
    const { data: amagoro, error: amagoroError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/amagoro-logo.jpeg' })
      .ilike('name', '%amagoro%')
      .select()

    const { data: shuletech, error: shuletechError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/shuletech-logo.png' })
      .ilike('name', '%shule%')
      .select()

    return Response.json({
      success: true,
      updated: {
        stMichael: stmichael,
        amagoro: amagoro,
        shuletech: shuletech
      },
      message: 'All school logos updated successfully'
    })
  } catch (error) {
    console.error('[v0] Error:', error)
    return Response.json(
      { error: 'Failed to update logos' },
      { status: 500 }
    )
  }
}
