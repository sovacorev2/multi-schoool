import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { schoolCode, logoUrl } = await request.json()

    if (!schoolCode || !logoUrl) {
      return Response.json({ error: 'Missing schoolCode or logoUrl' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Update the school's logo_url
    const { data, error } = await supabase
      .from('schools')
      .update({ logo_url: logoUrl })
      .eq('code', schoolCode)
      .select('id, name, logo_url')
      .single()

    if (error) {
      console.error('[v0] Error updating school logo:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    console.log('[v0] Updated logo for school:', data.name, 'to:', logoUrl)
    return Response.json({ 
      success: true, 
      school: data 
    })
  } catch (error) {
    console.error('[v0] Error in set-school-logo:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
