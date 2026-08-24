import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RequisitionHeader } from '@/components/requisition/app-header'
import { ApprovalActions } from '@/components/requisition/approval-actions'
import { RequisitionStamp } from '@/components/requisition/stamp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import type { Requisition, RequisitionItem } from '@/lib/requisition/types'

function statusBadge(status: Requisition['status']) {
  if (status === 'approved') return <Badge variant="success">Approved</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Declined</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/requisition/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/requisition/login')

  const { data: requisition } = await supabase
    .from('requisitions')
    .select('*, requester:requester_id(*), decider:decided_by(*)')
    .eq('id', id)
    .single()

  if (!requisition) notFound()

  const { data: items } = await supabase
    .from('requisition_items')
    .select('*')
    .eq('requisition_id', id) as { data: RequisitionItem[] | null }

  const canDecide = profile.is_approver && requisition.status === 'pending'

  return (
    <div className="min-h-screen bg-secondary/40">
      <RequisitionHeader fullName={profile.full_name} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/requisition" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground no-print">
          <ArrowLeft className="h-4 w-4" /> Back to requisitions
        </Link>

        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{requisition.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Requested by {requisition.requester?.full_name} on {new Date(requisition.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {statusBadge(requisition.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">{requisition.type === 'goods' ? 'Goods' : 'Cash'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-semibold">{formatKES(requisition.amount)}</p>
              </div>
            </div>

            {requisition.description && (
              <div>
                <p className="text-sm text-muted-foreground">Justification</p>
                <p className="text-sm">{requisition.description}</p>
              </div>
            )}

            {items && items.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Items</p>
                <div className="space-y-1 text-sm">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between border-b border-border py-1 last:border-0">
                      <span>{it.description} &times; {it.quantity}</span>
                      <span>{formatKES(it.quantity * it.unit_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {requisition.status !== 'pending' && (
              <div className="space-y-3 border-t border-border pt-4">
                {requisition.remarks && (
                  <div>
                    <p className="text-sm text-muted-foreground">Remarks from {requisition.decider?.full_name}</p>
                    <p className="text-sm">{requisition.remarks}</p>
                  </div>
                )}
                <RequisitionStamp requisition={requisition} deciderName={requisition.decider?.full_name || ''} />
              </div>
            )}
          </CardContent>
        </Card>

        {canDecide && <ApprovalActions requisitionId={requisition.id} />}
      </main>
    </div>
  )
}
