import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/requisition/supabase-service'
import { sendRequisitionSubmitted } from '@/lib/requisition/email'

export const runtime = 'nodejs'

// Fired by a Supabase Database Webhook on requisitions INSERT (see the
// requisitions feature's setup notes). Runs as a trusted server-to-server
// call, not a logged-in user, so it needs the service-role client to read
// across RLS, and a shared secret to prove the call actually came from our
// own webhook rather than an open POST to a guessable URL.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.REQUISITIONS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  const requisition = payload.record

  const supabase = createServiceClient()

  const [{ data: requester }, { data: approvers }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', requisition.requester_id).single(),
    supabase.from('profiles').select('*').eq('is_approver', true),
  ])

  if (!requester || !approvers || approvers.length === 0) {
    return NextResponse.json({ error: 'Requester or approver not found' }, { status: 200 })
  }

  await Promise.all(approvers.map((approver: any) => sendRequisitionSubmitted(approver, requisition, requester)))

  return NextResponse.json({ ok: true })
}
