import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Update Amagoro logo - try both possible name variations
    const { error: amagoroError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/amagoro-logo.jpeg' })
      .ilike('name', '%amagoro%')

    if (amagoroError) throw amagoroError

    // Get all schools to check their logos
    const { data: schools, error: fetchError } = await supabase
      .from('schools')
      .select('id, name, logo_url')

    if (fetchError) throw fetchError

    console.log('[v0] Updated logos. Current state:')
    schools?.forEach(s => {
      console.log(`  - ${s.name}: ${s.logo_url || 'NO LOGO'}`)
    })

    return NextResponse.json({
      success: true,
      message: 'School logos updated',
      schools
    })
  } catch (error) {
    console.error('[v0] Error updating logos:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
