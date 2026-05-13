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

    const { data: transactions, error } = await supabase
      .from('sms_transactions')
      .select('id, status, bundle_id, sms_bundles(sms_count, price), created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json({ 
      transactions: transactions?.map(t => ({
        id: t.id,
        status: t.status,
        bundle_sms_count: t.sms_bundles?.sms_count,
        bundle_price: t.sms_bundles?.price,
        created_at: t.created_at
      })) || []
    })
  } catch (error) {
    console.error('[v0] Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
