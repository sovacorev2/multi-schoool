import { cn } from '@/lib/utils'
import type { Requisition } from '@/lib/requisition/types'

function formatStampDate(iso: string) {
  return new Date(iso).toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RequisitionStamp({ requisition, deciderName }: { requisition: Requisition; deciderName: string }) {
  if (requisition.status === 'pending' || !requisition.decided_at) return null
  const approved = requisition.status === 'approved'

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center gap-0.5 rounded-md border-4 px-6 py-3 -rotate-6 select-none',
        approved ? 'border-success text-success' : 'border-destructive text-destructive'
      )}
      style={{ borderStyle: 'double' }}
    >
      <span className="text-2xl font-black tracking-widest">{approved ? 'APPROVED' : 'DECLINED'}</span>
      <span className="text-xs font-semibold tracking-wide">{deciderName}</span>
      <span className="text-xs">{formatStampDate(requisition.decided_at)}</span>
    </div>
  )
}
