import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { schoolId, logoUrl } = await request.json()

    if (!schoolId || !logoUrl) {
      return NextResponse.json(
        { error: 'schoolId and logoUrl are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Update school with logo_url
    const { data: school, error } = await supabase
      .from('schools')
      .update({ logo_url: logoUrl })
      .eq('id', schoolId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      school,
      message: `Logo updated for ${school.name}` 
    })
  } catch (error) {
    console.error('[v0] Fix school logo error:', error)
    return NextResponse.json({ error: 'Failed to update logo' }, { status: 500 })
  }
}
