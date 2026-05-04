import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('[v0] Updating school logos...')

    // Update Amagoro
    const { error: amagoroError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/amagoro-logo.jpeg' })
      .ilike('name', '%amagoro%')

    if (amagoroError) throw amagoroError

    // Update ShuleTech
    const { error: shuletechError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/shuletech-logo.png' })
      .ilike('name', '%shule%')

    if (shuletechError) throw shuletechError

    // Verify
    const { data } = await supabase
      .from('schools')
      .select('name, logo_url')

    return NextResponse.json({ 
      success: true, 
      message: 'School logos updated successfully',
      schools: data 
    })
  } catch (error) {
    console.error('[v0] Error updating logos:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
