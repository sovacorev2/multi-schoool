'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { RequisitionType } from '@/lib/requisition/types'

interface ItemRow {
  description: string
  quantity: string
  unit_cost: string
}

export default function NewRequisitionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [type, setType] = useState<RequisitionType>('cash')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ description: '', quantity: '1', unit_cost: '' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (type === 'cash' && items.length > 1) setItems([{ description: '', quantity: '1', unit_cost: '' }])
  }, [type])

  const itemsTotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0),
    [items]
  )
  const totalAmount = type === 'cash' ? Number(cashAmount) || 0 : itemsTotal

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: '1', unit_cost: '' }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Give this requisition a short title.')
      return
    }
    if (totalAmount <= 0) {
      setError(type === 'cash' ? 'Enter the amount you are requesting.' : 'Add at least one item with a cost.')
      return
    }

    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/requisition/login')
      return
    }

    const { data: requisition, error: insertError } = await supabase
      .from('requisitions')
      .insert({
        requester_id: user.id,
        type,
        title: title.trim(),
        description: description.trim(),
        amount: totalAmount,
      })
      .select('id')
      .single()

    if (insertError || !requisition) {
      setError(`Failed to submit: ${insertError?.message}`)
      setIsSubmitting(false)
      return
    }

    if (type === 'goods') {
      const rows = items
        .filter((it) => it.description.trim())
        .map((it) => ({
          requisition_id: requisition.id,
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unit_cost: Number(it.unit_cost) || 0,
        }))
      if (rows.length > 0) await supabase.from('requisition_items').insert(rows)
    }

    router.push(`/requisition/requisitions/${requisition.id}`)
  }

  return (
    <div className="min-h-screen bg-secondary/40 py-6">
      <div className="mx-auto max-w-2xl px-4">
        <Link href="/requisition" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to requisitions
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>New requisition</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as RequisitionType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="goods">Goods</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Title / Purpose</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Office stationery for Q3" className="mt-1" required />
              </div>

              <div>
                <Label htmlFor="description">Justification</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this is needed" className="mt-1" />
              </div>

              {type === 'cash' ? (
                <div>
                  <Label htmlFor="amount">Amount (KES)</Label>
                  <Input id="amount" type="number" min="0" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="mt-1" />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Items</Label>
                  {items.map((it, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
                      <div className="flex-1 min-w-40">
                        <Label className="text-xs">Description</Label>
                        <Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="mt-1 h-9" />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className="mt-1 h-9" />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Unit cost</Label>
                        <Input type="number" min="0" step="0.01" value={it.unit_cost} onChange={(e) => updateItem(i, { unit_cost: e.target.value })} className="mt-1 h-9" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                  <p className="text-sm font-medium">Total: KES {itemsTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit for approval'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
