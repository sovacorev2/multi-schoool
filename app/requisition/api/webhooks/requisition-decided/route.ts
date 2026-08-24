import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/requisition/supabase-service'
import { sendRequisitionDecided } from '@/lib/requisition/email'

export const runtime = 'nodejs'

// Fired by a Supabase Database Webhook on requisitions UPDATE. Only actually
// sends when this update is the pending -> approved/rejected transition, so
// later edits (if any) don't re-fire the "decided" email.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.REQUISITIONS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  const requisition = payload.record
  const oldRequisition = payload.old_record

  if (!oldRequisition || oldRequisition.status !== 'pending' || requisition.status === 'pending') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = createServiceClient()

  const [{ data: requester }, { data: decider }, { data: everyone }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', requisition.requester_id).single(),
    supabase.from('profiles').select('*').eq('id', requisition.decided_by).single(),
    supabase.from('profiles').select('*'),
  ])

  if (!requester || !decider || !everyone) {
    return NextResponse.json({ error: 'Requester or decider not found' }, { status: 200 })
  }

  await sendRequisitionDecided(everyone, requisition, requester, decider)

  return NextResponse.json({ ok: true })
}
