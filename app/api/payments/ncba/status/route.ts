import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryStkPushStatus } from '@/lib/ncba-client'
import { applySuccessfulPayment } from '@/lib/ncba-payment-processing'

export const dynamic = 'force-dynamic'

// Actively checks NCBA for an STK push's real result, instead of waiting on
// their confirmation webhook - several real STK pushes were accepted but
// never triggered a webhook call even minutes later, so this is the
// reliable path for STK-initiated payments specifically (see
// lib/ncba-client.ts). Polled repeatedly by the client after "Pay Now"
// (components/school-locked-screen.tsx) until it resolves or gives up.
export async function POST(request: Request) {
  const { transactionId } = await request.json().catch(() => ({}))
  if (!transactionId) {
    return NextResponse.json({ status: 'UNKNOWN', error: 'Missing transactionId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: txn } = await supabase
    .from('payment_transactions')
    .select('id, school_id, status')
    .eq('ncba_transaction_id', transactionId)
    .maybeSingle()

  if (!txn) {
    return NextResponse.json({ status: 'UNKNOWN' })
  }
  if (txn.status !== 'pending') {
    // Already resolved - by a previous poll, or the webhook if it did land.
    return NextResponse.json({ status: txn.status === 'success' ? 'SUCCESS' : 'FAILED' })
  }

  try {
    const result = await queryStkPushStatus(transactionId)
    if (result.status === 'UNKNOWN') {
      return NextResponse.json({ status: 'PENDING' })
    }

    await supabase
      .from('payment_transactions')
      .update({
        status: result.status === 'SUCCESS' ? 'success' : 'failed',
        raw_payload: result.raw as any,
        completed_at: new Date().toISOString(),
      })
      .eq('id', txn.id)

    if (result.status === 'SUCCESS' && txn.school_id) {
      await applySuccessfulPayment(supabase, txn.school_id)
    }

    return NextResponse.json({ status: result.status, description: result.description })
  } catch (error) {
    console.error('[ncba-status] Error querying STK push status:', error)
    // Transient error - let the client keep polling rather than surfacing a failure.
    return NextResponse.json({ status: 'PENDING' })
  }
}
