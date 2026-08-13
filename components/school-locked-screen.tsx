'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Phone, Smartphone, Loader2, CheckCircle2 } from 'lucide-react'

const SUPPORT_EMAIL = 'admin@shuletechsolutions.co.ke'
const SUPPORT_PHONE_DISPLAY = '0756288563'
const SUPPORT_PHONE_TEL = '+254756288563'

// After sending an STK prompt, the school admin might not approve it in time
// (M-Pesa prompts expire) - re-enabling the button after a short cooldown
// lets them just try again instead of being stuck with a one-shot send.
const RESEND_COOLDOWN_SECONDS = 20

// NCBA's confirmation webhook has repeatedly not fired for real STK-initiated
// payments (confirmed live), so this actively polls /api/payments/ncba/status
// instead of only waiting passively - roughly covers how long an STK prompt
// stays valid before it expires unapproved.
const POLL_INTERVAL_MS = 4000
const POLL_MAX_ATTEMPTS = 20

export function SchoolLockedScreen({
  school,
  variant = 'public',
}: {
  school: { id?: string; name: string; code?: string; logo_url?: string | null; primary_color?: string | null; payment_amount?: number | null }
  variant?: 'public' | 'admin'
}) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [payState, setPayState] = useState<'idle' | 'sending' | 'sent' | 'confirmed' | 'error'>('idle')
  const [payMessage, setPayMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const cancelledRef = useRef(false)
  useEffect(() => () => { cancelledRef.current = true }, [])

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Reactivate ${school.name}${school.code ? ` (${school.code})` : ''}`
  )}&body=${encodeURIComponent(`Hello ShuleTech,\n\nWe would like to reactivate access for ${school.name}.\n\n`)}`

  const canPay = variant === 'admin' && !!school.id && !!school.payment_amount

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const pollTransactionStatus = async (transactionId: string) => {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      if (cancelledRef.current) return
      try {
        const res = await fetch('/api/payments/ncba/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId }),
        })
        const data = await res.json()
        if (cancelledRef.current) return
        if (data.status === 'SUCCESS') {
          setPayState('confirmed')
          setPayMessage('Payment confirmed - unlocking now.')
          return
        }
        if (data.status === 'FAILED') {
          setPayState('error')
          setPayMessage(data.description || 'Payment was not completed - you can try again.')
          return
        }
      } catch {
        // Transient network error - keep polling.
      }
    }
  }

  const handlePayNow = async () => {
    if (!school.id || !phoneNumber.trim()) return
    setPayState('sending')
    setPayMessage('')
    try {
      const res = await fetch('/api/payments/ncba/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: school.id, phoneNumber: phoneNumber.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setPayState('sent')
        setPayMessage(`Prompt sent to ${phoneNumber.trim()} - approve it on your phone. Checking for confirmation...`)
        if (data.transactionId) pollTransactionStatus(data.transactionId)
      } else {
        setPayState('error')
        setPayMessage(data.error || 'Failed to send payment prompt.')
      }
    } catch (err) {
      setPayState('error')
      setPayMessage(err instanceof Error ? err.message : 'Failed to send payment prompt.')
    }
    startCooldown()
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg bg-card dark:bg-card border-border dark:border-border">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            {school.logo_url ? (
              <img
                src={school.logo_url}
                alt={`${school.name} logo`}
                className="w-20 h-20 object-contain opacity-60"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl opacity-60"
                style={{ backgroundColor: school.primary_color || '#2563eb' }}
              >
                {school.name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold mb-2 text-foreground dark:text-foreground break-words">{school.name}</CardTitle>
            <CardDescription className="text-base text-muted-foreground dark:text-muted-foreground">
              Access Temporarily Unavailable
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            This school&apos;s ShuleTech account needs to be renewed before it can be accessed again.
          </p>
          {variant === 'admin' ? (
            <>
              {canPay ? (
                <div className="text-left space-y-3 bg-muted dark:bg-muted rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">Subscription due</p>
                    <p className="text-2xl font-bold text-foreground dark:text-foreground">KES {school.payment_amount!.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label htmlFor="pay-phone" className="text-xs">M-Pesa phone number</Label>
                    <Input
                      id="pay-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="mt-1"
                      disabled={payState === 'sending'}
                    />
                  </div>
                  <Button
                    onClick={handlePayNow}
                    disabled={!phoneNumber.trim() || payState === 'sending' || cooldown > 0}
                    className="w-full"
                  >
                    {payState === 'sending' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending prompt...</>
                    ) : cooldown > 0 ? (
                      `Resend in ${cooldown}s`
                    ) : (
                      <><Smartphone className="w-4 h-4 mr-2" /> Pay Now</>
                    )}
                  </Button>
                  {payMessage && (
                    <p className={`text-xs rounded px-2 py-1.5 flex items-start gap-1.5 ${payState === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {payState === 'sent' && <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />}
                      {payState === 'confirmed' && <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <span>{payMessage}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                  As the school admin, you can reach out to ShuleTech directly to sort out payment and get access restored.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="w-full">
                  <a href={mailtoHref}>
                    <Mail className="w-4 h-4 mr-2 shrink-0" />
                    Email ShuleTech
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={`tel:${SUPPORT_PHONE_TEL}`}>
                    <Phone className="w-4 h-4 mr-2 shrink-0" />
                    Call {SUPPORT_PHONE_DISPLAY}
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground break-all">{SUPPORT_EMAIL}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              Please contact your school administrator, or reach out to ShuleTech support to complete payment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
