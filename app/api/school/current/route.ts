import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get the current admin user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get school ID from school_admins table
    const { data: adminData, error: adminError } = await supabase
      .from('school_admins')
      .select('school_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    // Get school data
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, code, feature_sms, feature_whatsapp_reports, feature_report_cards, feature_bulk_sms')
      .eq('id', adminData.school_id)
      .single()

    if (schoolError || !schoolData) {
      return NextResponse.json({ error: 'School data not found' }, { status: 404 })
    }

    return NextResponse.json(schoolData)
  } catch (error) {
    console.error('[v0] Error getting school data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
