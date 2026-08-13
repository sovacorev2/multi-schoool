import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// How long a successful payment extends access for. Adjust once you know the
// actual term length you're billing for.
const SUBSCRIPTION_EXTENSION_DAYS = 120

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

function fail(resultDesc: string) {
  return NextResponse.json({ ResultCode: '1', ResultDesc: resultDesc })
}

function ok() {
  return NextResponse.json({ ResultCode: '0', ResultDesc: 'Payment received' })
}

export async function POST(request: Request) {
  // Confirmed against one real NCBA test notification (2026-08-13, TransID
  // UHDKF2URGE): field names/shapes below (TransType, TransID, BillRefNumber,
  // BusinessShortCode, Hash, etc.) and the missing-Status-means-success
  // inference are now grounded in a real payload, not just the integration
  // guide. Still unconfirmed: whether BillRefNumber reliably echoes back
  // exactly what we send as AccountNo on a real STK-initiated payment (that
  // test wasn't initiated through our own /api/payments/ncba/initiate) -
  // worth a real end-to-end STK test once a school has payment_amount set.
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

  // Attribution: we set AccountNo = school.code when we initiate an STK Push, so
  // BillRefNumber is expected to echo that back. UNCONFIRMED with NCBA - flagged
  // as the #1 thing to verify once you have real credentials/test payloads.
  const schoolCode = billRefNumber.trim()
  const { data: school } = await supabase
    .from('schools')
    .select('id, subscription_expires_at, lock_override')
    .ilike('code', schoolCode)
    .single()

  if (!school) {
    console.error('[ncba-webhook] No school found for BillRefNumber/AccountNo', schoolCode)
    // Still record the transaction (unattributed) so nothing silently disappears.
    const { error: unattributedError } = await supabase.from('payment_transactions').upsert({
      school_id: null,
      amount: Number(transAmount) || 0,
      phone_number: mobile,
      ncba_transaction_id: transId,
      status: 'failed',
      raw_payload: body,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'ncba_transaction_id' })
    if (unattributedError) console.error('[ncba-webhook] Failed to record unattributed transaction', transId, unattributedError)
    return fail('Could not attribute payment to a school')
  }

  // NCBA's real test notification had no Status field at all - this endpoint
  // is a C2B-style confirmation callback (TransType/TransID/BillRefNumber
  // shape), and confirmation callbacks in that pattern only ever fire for
  // completed payments (a failed attempt never reaches a confirmation URL).
  // So a missing Status means success; an explicit non-success value (if
  // NCBA ever sends one for some other transaction type) still overrides it.
  const statusField = String(body.Status ?? '').toUpperCase()
  const isSuccess = statusField === '' || statusField === 'SUCCESS'

  const { error: recordError } = await supabase.from('payment_transactions').upsert({
    school_id: school.id,
    amount: Number(transAmount) || 0,
    phone_number: mobile,
    ncba_transaction_id: transId,
    status: isSuccess ? 'success' : 'failed',
    raw_payload: body,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'ncba_transaction_id' })
  if (recordError) console.error('[ncba-webhook] Failed to record transaction', transId, recordError)

  if (isSuccess) {
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
