import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// How long a successful payment extends access for. Adjust once you know the
// actual term length you're billing for.
const SUBSCRIPTION_EXTENSION_DAYS = 120

// How far back to look for the pending payment this confirmation belongs to -
// wide enough to cover a school admin who takes a while to approve the STK
// prompt on their phone.
const ATTRIBUTION_WINDOW_MINUTES = 60

// Replicates NCBA's Java sample exactly (see "SecretKey Generation" in their
// Push Notification guide): concatenate secretKey + fields + "1", SHA-256 it to a
// HEX STRING, then Base64-encode the UTF-8 BYTES OF THAT HEX STRING (not the raw
// hash bytes - this is unusual but matches their sample code precisely).
function computeExpectedHash(params: {
  transType: string
  transId: string
  transTime: string
  transAmount: string
  creditAccount: string
  billRefNumber: string
  mobile: string
  name: string
}): string {
  const secretKey = process.env.NCBA_SECRET_KEY || ''
  const hashString =
    secretKey +
    params.transType +
    params.transId +
    params.transTime +
    params.transAmount +
    params.creditAccount +
    params.billRefNumber +
    params.mobile +
    params.name +
    '1'
  const sha256hex = createHash('sha256').update(hashString, 'utf8').digest('hex')
  return Buffer.from(sha256hex, 'utf8').toString('base64')
}

// Kenyan numbers arrive in different shapes (0712345678, 254712345678,
// +254712345678) - compare on the last 9 digits so any of those match each
// other. If the incoming value isn't phone-shaped at all (e.g. some opaque
// token), this just won't match anything, which is fine - amount + recency
// still narrows it down.
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-9)
}

function fail(resultDesc: string) {
  return NextResponse.json({ ResultCode: '1', ResultDesc: resultDesc })
}

function ok() {
  return NextResponse.json({ ResultCode: '0', ResultDesc: 'Payment received' })
}

export async function POST(request: Request) {
  // Confirmed against one real NCBA test notification (2026-08-13, TransID
  // UHDKF2URGE): field names/shapes below and the missing-Status-means-
  // success inference are grounded in a real payload, not just the
  // integration guide. Also confirmed live (a failed real STK attempt):
  // NCBA rejects any AccountNo that isn't our one fixed registered account
  // number (159997 at the time of writing) - so unlike a typical Safaricom
  // Daraja setup, AccountNo/BillRefNumber can't carry a per-school reference.
  // Attribution instead matches this confirmation to the pending
  // payment_transactions row our own /api/payments/ncba/initiate created,
  // by amount + phone number (see below) - not by BillRefNumber.
  let body: any
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body')
  }

  const expectedUsername = process.env.NCBA_WEBHOOK_USERNAME
  const expectedPassword = process.env.NCBA_WEBHOOK_PASSWORD
  const secretConfigured = !!process.env.NCBA_SECRET_KEY

  if (!expectedUsername || !expectedPassword || !secretConfigured) {
    console.error('[ncba-webhook] Received a notification but NCBA_WEBHOOK_USERNAME/PASSWORD/NCBA_SECRET_KEY are not configured')
    return fail('Webhook not configured')
  }

  // NCBA sends Username/Password as fields in the request body, not as an HTTP
  // Authorization header (confirmed from their sample payloads).
  if (body.Username !== expectedUsername || body.Password !== expectedPassword) {
    console.error('[ncba-webhook] Username/Password mismatch on incoming notification')
    return fail('Authentication failed')
  }

  const transType = String(body.TransType ?? '')
  const transId = String(body.TransID ?? '')
  const transTime = String(body.TransTime ?? '')
  const transAmount = String(body.TransAmount ?? '')
  const creditAccount = String(body.BusinessShortCode ?? body.AccountNr ?? '')
  const billRefNumber = String(body.BillRefNumber ?? body.Narrative ?? '')
  const mobile = String(body.Mobile ?? body.PhoneNr ?? '')
  const name = String(body.name ?? body.CustomerName ?? '')

  if (!transId) return fail('Missing TransID')

  const expectedHash = computeExpectedHash({ transType, transId, transTime, transAmount, creditAccount, billRefNumber, mobile, name })
  if (body.Hash !== expectedHash) {
    console.error('[ncba-webhook] Hash verification failed for TransID', transId)
    return fail('Hash verification failed')
  }

  const supabase = await createClient()

  // NCBA (or a flaky connection) can redeliver the same confirmation more
  // than once - if we've already recorded this exact TransID, it's already
  // been processed (subscription already extended), so just acknowledge it
  // rather than matching/extending again.
  const { data: alreadyProcessed } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('ncba_transaction_id', transId)
    .maybeSingle()
  if (alreadyProcessed) return ok()

  // NCBA's real test notification had no Status field at all - this endpoint
  // is a C2B-style confirmation callback (TransType/TransID/BillRefNumber
  // shape), and confirmation callbacks in that pattern only ever fire for
  // completed payments (a failed attempt never reaches a confirmation URL).
  // So a missing Status means success; an explicit non-success value (if
  // NCBA ever sends one for some other transaction type) still overrides it.
  const statusField = String(body.Status ?? '').toUpperCase()
  const isSuccess = statusField === '' || statusField === 'SUCCESS'
  const transAmountNum = Number(transAmount) || 0
  const normalizedIncomingMobile = normalizePhone(mobile)

  const windowStart = new Date(Date.now() - ATTRIBUTION_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { data: pendingCandidates } = await supabase
    .from('payment_transactions')
    .select('id, school_id, phone_number')
    .eq('status', 'pending')
    .eq('amount', transAmountNum)
    .gte('initiated_at', windowStart)
    .order('initiated_at', { ascending: false })

  const matched =
    (pendingCandidates || []).find((t) => normalizedIncomingMobile && normalizePhone(t.phone_number || '') === normalizedIncomingMobile) ||
    (pendingCandidates && pendingCandidates.length > 0 ? pendingCandidates[0] : null)

  if (!matched || !matched.school_id) {
    console.error('[ncba-webhook] Could not match confirmation to a pending payment', { transId, amount: transAmountNum, mobile })
    const { error: unattributedError } = await supabase.from('payment_transactions').insert({
      school_id: null,
      amount: transAmountNum,
      phone_number: mobile,
      ncba_transaction_id: transId,
      status: isSuccess ? 'success' : 'failed',
      raw_payload: body,
      completed_at: new Date().toISOString(),
    })
    if (unattributedError) console.error('[ncba-webhook] Failed to record unattributed transaction', transId, unattributedError)
    return fail('Could not attribute payment to a school')
  }

  const { data: school } = await supabase
    .from('schools')
    .select('id, subscription_expires_at, lock_override')
    .eq('id', matched.school_id)
    .single()

  const { error: recordError } = await supabase
    .from('payment_transactions')
    .update({
      ncba_transaction_id: transId,
      status: isSuccess ? 'success' : 'failed',
      raw_payload: body,
      completed_at: new Date().toISOString(),
    })
    .eq('id', matched.id)
  if (recordError) console.error('[ncba-webhook] Failed to record transaction', transId, recordError)

  if (isSuccess && school) {
    const now = new Date()
    const currentExpiry = school.subscription_expires_at ? new Date(school.subscription_expires_at) : now
    const extendFrom = currentExpiry > now ? currentExpiry : now
    const newExpiry = new Date(extendFrom.getTime() + SUBSCRIPTION_EXTENSION_DAYS * 24 * 60 * 60 * 1000)

    const updates: Record<string, unknown> = { subscription_expires_at: newExpiry.toISOString() }
    // A successful payment shouldn't silently override an explicit "force locked"
    // super-admin decision - only auto-unlock if there's no override, or the
    // override already says unlocked.
    if (school.lock_override !== false) {
      updates.is_active = true
    }

    await supabase.from('schools').update(updates).eq('id', school.id)
  }

  return ok()
}
