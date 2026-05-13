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

    const { data: usage, error } = await supabase
      .from('sms_usage_logs')
      .select('id, recipient_count, message_preview, sms_deducted, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
    }

    return NextResponse.json({ usage: usage || [] })
  } catch (error) {
    console.error('[v0] Error fetching usage history:', error)
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}
