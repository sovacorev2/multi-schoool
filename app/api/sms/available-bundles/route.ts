import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: bundles, error } = await supabase
      .from('sms_bundles')
      .select('id, sms_count, price, description')
      .eq('is_active', true)
      .order('sms_count', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 })
    }

    return NextResponse.json({ bundles: bundles || [] })
  } catch (error) {
    console.error('[v0] Error fetching bundles:', error)
    return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 })
  }
}
