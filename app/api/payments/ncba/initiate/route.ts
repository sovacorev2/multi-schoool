import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { initiateStkPush, isNcbaConfigured } from '@/lib/ncba-client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isNcbaConfigured()) {
    return NextResponse.json(
      { success: false, error: 'NCBA payments are not configured yet (missing NCBA_API_USERNAME / NCBA_API_PASSWORD / NCBA_PAYBILL_NO).' },
      { status: 503 }
    )
  }

  const { schoolId } = await request.json().catch(() => ({}))
  if (!schoolId) {
    return NextResponse.json({ success: false, error: 'Missing schoolId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: school } = await supabase
    .from('schools')
    .select('id, code, name, payment_amount, payment_phone_number')
    .eq('id', schoolId)
    .single()

  if (!school) {
    return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 })
  }
  if (!school.payment_amount || !school.payment_phone_number) {
    return NextResponse.json(
      { success: false, error: 'This school has no payment amount / phone number configured yet.' },
      { status: 400 }
    )
  }

  try {
    const result = await initiateStkPush({
      telephoneNo: school.payment_phone_number,
      amount: school.payment_amount,
      accountNo: school.code, // echoed back on the webhook as BillRefNumber — see webhook route's attribution note
    })

    await supabase.from('payment_transactions').insert({
      school_id: school.id,
      amount: school.payment_amount,
      phone_number: school.payment_phone_number,
      ncba_transaction_id: result.transactionId,
      reference_id: result.referenceId,
      status: result.success ? 'pending' : 'failed',
      raw_payload: result.raw as any,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.statusDescription || 'STK Push failed to send' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      message: `Payment prompt sent to ${school.payment_phone_number}`,
      transactionId: result.transactionId,
    })
  } catch (error) {
    console.error('[ncba-initiate] Error initiating STK Push:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
