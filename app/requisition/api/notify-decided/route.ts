import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendRequisitionDecided } from '@/lib/requisition/email'

export const runtime = 'nodejs'

// Called directly from the client right after an approve/decline update
// succeeds (see components/requisition/approval-actions.tsx). See
// notify-submitted/route.ts for why this isn't a Database Webhook.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { requisitionId } = await request.json()

  const [{ data: requisition }, { data: everyone }] = await Promise.all([
    supabase.from('requisitions').select('*').eq('id', requisitionId).single(),
    supabase.from('profiles').select('*'),
  ])

  if (!requisition || !everyone || requisition.status === 'pending') {
    return NextResponse.json({ error: 'Requisition not found or not yet decided' }, { status: 200 })
  }

  const requester = everyone.find((p) => p.id === requisition.requester_id)
  const decider = everyone.find((p) => p.id === requisition.decided_by)
  if (!requester || !decider) {
    return NextResponse.json({ error: 'Requester or decider not found' }, { status: 200 })
  }

  try {
    await sendRequisitionDecided(everyone, requisition, requester, decider)
  } catch (error) {
    console.error('[requisition] Failed to send decided notification:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Send failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
