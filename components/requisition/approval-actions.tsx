'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, X } from 'lucide-react'

export function ApprovalActions({ requisitionId }: { requisitionId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(status: 'approved' | 'rejected') {
    setError(null)

    if (status === 'rejected' && !remarks.trim()) {
      setError('Give a reason for declining this requisition.')
      return
    }

    setIsSubmitting(status)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('requisitions')
      .update({ status, remarks: remarks.trim() || null, decided_by: user.id, decided_at: new Date().toISOString() })
      .eq('id', requisitionId)

    if (error) {
      setError(`Failed to save your decision: ${error.message}`)
      setIsSubmitting(null)
      return
    }

    // Best-effort - the decision itself is already saved, so a failed
    // notification shouldn't block the page from updating.
    fetch('/requisition/api/notify-decided', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requisitionId }),
    }).catch(() => {})

    router.refresh()
  }

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle className="text-base">Your decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-1" placeholder="Any notes for the requester" />
          <p className="mt-1 text-xs text-muted-foreground">Optional when approving, required when declining.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="success" onClick={() => decide('approved')} disabled={isSubmitting !== null} className="flex-1">
            <Check className="h-4 w-4" /> {isSubmitting === 'approved' ? 'Approving...' : 'Approve'}
          </Button>
          <Button variant="destructive" onClick={() => decide('rejected')} disabled={isSubmitting !== null} className="flex-1">
            <X className="h-4 w-4" /> {isSubmitting === 'rejected' ? 'Declining...' : 'Decline'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
