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

    // Update ShuleTech logo
    const { error: shuletechError } = await supabase
      .from('schools')
      .update({ logo_url: '/logos/shuletech-logo.png' })
      .ilike('name', '%shule%')

    if (shuletechError) throw shuletechError

    // Update St Michael logo with Blob URL
    const { error: stmichaelError } = await supabase
      .from('schools')
      .update({ logo_url: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/stmichaellogo-uFafBc9amB4gT3cJroyU531usCnSy8.jpeg' })
      .ilike('name', '%st michael%')

    if (stmichaelError) throw stmichaelError

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
