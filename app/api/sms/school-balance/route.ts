import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const schoolId = request.headers.get('x-school-id')
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { data: schoolCredit, error } = await supabase
      .from('school_sms_credits')
      .select('balance')
      .eq('school_id', schoolId)
      .single()

    if (error || !schoolCredit) {
      return NextResponse.json({ balance: 0 })
    }

    return NextResponse.json({ balance: schoolCredit.balance || 0 })
  } catch (error) {
    console.error('[v0] Error fetching SMS balance:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
