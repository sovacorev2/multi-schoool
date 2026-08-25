import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendRequisitionSubmitted } from '@/lib/requisition/email'

export const runtime = 'nodejs'

// Called directly from the client right after a requisition insert succeeds
// (see app/requisition/new/page.tsx) - not a Supabase Database Webhook, since
// this project's Supabase instance is missing the supabase_functions schema
// that feature depends on (a platform provisioning gap, not something
// fixable from the SQL Editor or dashboard). This approach is arguably
// cleaner anyway: it authenticates via the caller's real logged-in session
// (cookie-based, RLS-respecting) instead of a static shared secret, so no
// service-role key or webhook secret is needed for notifications at all.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { requisitionId } = await request.json()

  const [{ data: requisition }, { data: approvers }] = await Promise.all([
    supabase.from('requisitions').select('*').eq('id', requisitionId).single(),
    supabase.from('profiles').select('*').eq('is_approver', true),
  ])

  if (!requisition || !approvers || approvers.length === 0) {
    return NextResponse.json({ error: 'Requisition or approver not found' }, { status: 200 })
  }

  const { data: requester } = await supabase.from('profiles').select('*').eq('id', requisition.requester_id).single()
  if (!requester) {
    return NextResponse.json({ error: 'Requester not found' }, { status: 200 })
  }

  try {
    await Promise.all(approvers.map((approver) => sendRequisitionSubmitted(approver, requisition, requester)))
  } catch (error) {
    console.error('[requisition] Failed to send submitted notification:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Send failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
