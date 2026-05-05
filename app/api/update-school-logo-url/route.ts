import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { schoolCode, logoUrl } = await request.json()

    if (!schoolCode || !logoUrl) {
      return Response.json(
        { error: 'Missing schoolCode or logoUrl' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Update school's logo_url
    const { data, error } = await supabase
      .from('schools')
      .update({ logo_url: logoUrl })
      .eq('code', schoolCode)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating logo URL:', error)
      return Response.json(
        { error: `Failed to update logo URL: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('[v0] Successfully updated logo URL for school:', schoolCode)
    return Response.json({
      success: true,
      school: data,
      message: `Logo URL updated for ${data.name}`
    })
  } catch (error) {
    console.error('[v0] Error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
