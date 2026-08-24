import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RequisitionHeader } from '@/components/requisition/app-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import type { Requisition } from '@/lib/requisition/types'

function statusBadge(status: Requisition['status']) {
  if (status === 'approved') return <Badge variant="success">Approved</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Declined</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function RequisitionDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/requisition/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/requisition/login')

  let query = supabase
    .from('requisitions')
    .select('*, requester:requester_id(*), decider:decided_by(*)')
    .order('created_at', { ascending: false })

  if (tab === 'mine') query = query.eq('requester_id', user.id)
  if (tab === 'pending-approval') query = query.eq('status', 'pending')

  const { data: requisitions } = await query

  return (
    <div className="min-h-screen bg-secondary/40">
      <RequisitionHeader fullName={profile.full_name} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1 rounded-md bg-muted p-1">
            <Link href="/requisition?tab=all"><Button type="button" variant={tab === 'all' ? 'default' : 'ghost'} size="sm">All</Button></Link>
            <Link href="/requisition?tab=mine"><Button type="button" variant={tab === 'mine' ? 'default' : 'ghost'} size="sm">Mine</Button></Link>
            {profile.is_approver && (
              <Link href="/requisition?tab=pending-approval"><Button type="button" variant={tab === 'pending-approval' ? 'default' : 'ghost'} size="sm">Pending my approval</Button></Link>
            )}
          </div>
          <Link href="/requisition/new"><Button><Plus className="h-4 w-4" /> New requisition</Button></Link>
        </div>

        {!requisitions || requisitions.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No requisitions here yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {requisitions.map((r) => (
              <Link key={r.id} href={`/requisition/requisitions/${r.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.title}</span>
                        {statusBadge(r.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {r.requester?.full_name} &middot; {r.type === 'goods' ? 'Goods' : 'Cash'} &middot; {new Date(r.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">{formatKES(r.amount)}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
