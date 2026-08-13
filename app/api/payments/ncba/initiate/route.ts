import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { initiateStkPush, isNcbaConfigured } from '@/lib/ncba-client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isNcbaConfigured()) {
    return NextResponse.json(
      { success: false, error: 'NCBA payments are not configured yet (missing NCBA_API_USERNAME / NCBA_API_PASSWORD / NCBA_PAYBILL_NO / NCBA_ACCOUNT_NO).' },
      { status: 503 }
    )
  }

  const { schoolId, phoneNumber } = await request.json().catch(() => ({}))
  if (!schoolId) {
    return NextResponse.json({ success: false, error: 'Missing schoolId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, payment_amount, payment_phone_number')
    .eq('id', schoolId)
    .single()

  if (!school) {
    return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 })
  }
  // A school admin paying from the locked screen types the phone they want
  // to pay from right there (they don't always pay from the same phone) -
  // that takes priority over whatever's pre-stored, which only super-admin's
  // own "Send Payment Prompt" button relies on.
  const telephoneNo = (phoneNumber && String(phoneNumber).trim()) || school.payment_phone_number
  if (!school.payment_amount) {
    return NextResponse.json({ success: false, error: 'This school has no subscription amount configured yet.' }, { status: 400 })
  }
  if (!telephoneNo) {
    return NextResponse.json({ success: false, error: 'No phone number to send the payment prompt to.' }, { status: 400 })
  }

  try {
    const result = await initiateStkPush({ telephoneNo, amount: school.payment_amount })

    // Left as 'pending' with school_id already attached - the webhook can't
    // identify which school a confirmation belongs to via AccountNo (NCBA
    // requires that to always be our one fixed registered account number,
    // not a per-school reference), so it attributes by finding this exact
    // pending row instead (matched on amount + phone, see webhook route).
    await supabase.from('payment_transactions').insert({
      school_id: school.id,
      amount: school.payment_amount,
      phone_number: telephoneNo,
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
      message: `Payment prompt sent to ${telephoneNo}`,
      transactionId: result.transactionId,
    })
  } catch (error) {
    console.error('[ncba-initiate] Error initiating STK Push:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
