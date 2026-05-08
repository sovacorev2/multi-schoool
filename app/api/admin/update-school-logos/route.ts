import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Get all schools with their current logo status
    const { data: schools, error: fetchError } = await supabase
      .from('schools')
      .select('id, name, logo_url')
      .order('name')

    if (fetchError) throw fetchError

    // Separate schools with and without logos
    const schoolsWithLogos = schools?.filter(s => s.logo_url) || []
    const schoolsWithoutLogos = schools?.filter(s => !s.logo_url) || []

    console.log('[v0] School logo status:')
    console.log(`  With logos: ${schoolsWithLogos.length}`)
    schoolsWithLogos.forEach(s => {
      console.log(`    - ${s.name}: ${s.logo_url}`)
    })
    console.log(`  Without logos: ${schoolsWithoutLogos.length}`)
    schoolsWithoutLogos.forEach(s => {
      console.log(`    - ${s.name}`)
    })

    return NextResponse.json({
      success: true,
      message: 'School logo status retrieved',
      schools,
      summary: {
        total: schools?.length || 0,
        withLogo: schoolsWithLogos.length,
        withoutLogo: schoolsWithoutLogos.length
      }
    })
  } catch (error) {
    console.error('[v0] Error fetching school logos:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
