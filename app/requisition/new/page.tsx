'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { PaymentMethod, RequisitionType } from '@/lib/requisition/types'

interface ItemRow {
  description: string
  quantity: string
  unit_cost: string
}

function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">{title}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export default function NewRequisitionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [requesterName, setRequesterName] = useState('')
  const [type, setType] = useState<RequisitionType>('cash')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ description: '', quantity: '1', unit_cost: '' }])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRequesterName() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (data) setRequesterName(data.full_name)
    }
    loadRequesterName()
  }, [])

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
    if (paymentMethod === 'bank' && (!bankName.trim() || !accountNumber.trim() || !accountName.trim())) {
      setError('Fill in the bank name, account number, and account name.')
      return
    }
    if (paymentMethod === 'mobile_money' && (!recipientName.trim() || !phoneNumber.trim())) {
      setError('Fill in the recipient name and phone number.')
      return
    }

    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/requisition/login')
      return
    }

    const paymentDetails =
      paymentMethod === 'bank'
        ? { bank_name: bankName.trim(), account_number: accountNumber.trim(), account_name: accountName.trim() }
        : paymentMethod === 'mobile_money'
          ? { recipient_name: recipientName.trim(), phone_number: phoneNumber.trim() }
          : null

    const { data: requisition, error: insertError } = await supabase
      .from('requisitions')
      .insert({
        requester_id: user.id,
        type,
        title: title.trim(),
        description: description.trim(),
        amount: totalAmount,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
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

    // Best-effort - the requisition itself is already saved, so a failed
    // notification shouldn't block navigation or show as an error to the
    // requester.
    fetch('/requisition/api/notify-submitted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requisitionId: requisition.id }),
    }).catch(() => {})

    router.push(`/requisition/requisitions/${requisition.id}`)
  }

  const today = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-secondary/40 py-6">
      <div className="mx-auto max-w-2xl px-4">
        <Link href="/requisition" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to requisitions
        </Link>
        <Card className="overflow-hidden shadow-md">
          <div className="flex items-center gap-3 border-b border-border bg-primary px-6 py-4">
            <Image src="/icon-512.png" alt="STEMS" width={34} height={34} />
            <div className="leading-tight">
              <p className="font-bold tracking-wide text-primary-foreground">Requisition Form</p>
              <p className="text-xs text-primary-foreground/70">ShuleTech Exam Management System</p>
            </div>
          </div>

          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <section>
                <SectionHeading number={1} title="Requester information" />
                <div className="grid grid-cols-2 gap-4 rounded-md bg-secondary/10 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Requested by</p>
                    <p className="font-medium">{requesterName || '...'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{today}</p>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeading number={2} title="Requisition details" />
                <div className="space-y-4">
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
                </div>
              </section>

              <section>
                <SectionHeading number={3} title="Cost breakdown" />
                {type === 'cash' ? (
                  <div>
                    <Label htmlFor="amount">Amount (KES)</Label>
                    <Input id="amount" type="number" min="0" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="mt-1" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-md border border-border">
                      <div className="grid grid-cols-[1fr_60px_90px_36px] gap-2 border-b border-border bg-secondary/10 px-3 py-2 text-xs font-semibold text-muted-foreground">
                        <span>Description</span>
                        <span>Qty</span>
                        <span>Unit cost</span>
                        <span />
                      </div>
                      {items.map((it, i) => (
                        <div key={i} className="grid grid-cols-[1fr_60px_90px_36px] items-center gap-2 border-b border-border px-3 py-2 last:border-0">
                          <Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="h-8" placeholder="Item" />
                          <Input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className="h-8" />
                          <Input type="number" min="0" step="0.01" value={it.unit_cost} onChange={(e) => updateItem(i, { unit_cost: e.target.value })} className="h-8" />
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)} disabled={items.length === 1}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4" /> Add item
                    </Button>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between rounded-md bg-primary px-4 py-3">
                  <span className="text-sm font-medium text-primary-foreground">Total Amount</span>
                  <span className="text-lg font-bold text-primary-foreground">KES {totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                </div>
              </section>

              <section>
                <SectionHeading number={4} title="Payment details" />
                <div className="space-y-4">
                  <div>
                    <Label>How should this be paid?</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank transfer</SelectItem>
                        <SelectItem value="mobile_money">Mobile money (M-Pesa)</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentMethod === 'bank' && (
                    <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="bankName">Bank name</Label>
                        <Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Equity Bank" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="accountNumber">Account number</Label>
                        <Input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="accountName">Account name</Label>
                        <Input id="accountName" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'mobile_money' && (
                    <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="recipientName">Recipient name</Label>
                        <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="phoneNumber">Phone number</Label>
                        <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="07XXXXXXXX" className="mt-1" />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'cash' && (
                    <p className="rounded-md border border-border bg-secondary/10 p-3 text-sm text-muted-foreground">To be collected in person once approved.</p>
                  )}
                </div>
              </section>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit for approval'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
