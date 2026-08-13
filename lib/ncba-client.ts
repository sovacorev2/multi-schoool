// NCBA Till STK Push client - server-side only. Never import this from a 'use
// client' component; the credentials below must never reach the browser.
//
// Requires these env vars (server-only, no NEXT_PUBLIC_ prefix):
//   NCBA_API_USERNAME       - Basic Auth username for token generation
//   NCBA_API_PASSWORD       - Basic Auth password for token generation
//   NCBA_PAYBILL_NO         - the PayBillNo used for every STK Push (e.g. 880100)
//   NCBA_ACCOUNT_NO         - the fixed account number registered against our
//                             paybill with NCBA (e.g. 159997). Confirmed via a
//                             live failed transaction: NCBA rejects AccountNo
//                             values that aren't this exact registered number
//                             ("wrong format"), so unlike a typical Safaricom
//                             Daraja integration, this can't be a free-text
//                             per-school reference - it's the same for every
//                             school. Per-school attribution now happens in
//                             the webhook by matching the pending
//                             payment_transactions row instead (see
//                             app/api/payments/ncba/webhook/route.ts).
// Until NCBA has issued real credentials, isNcbaConfigured() returns false and
// every call site should show/return a clear "not configured yet" state instead
// of a confusing failure.

const BASE_URL = 'https://c2bapis.ncbagroup.com'

interface CachedToken {
  accessToken: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

export function isNcbaConfigured(): boolean {
  return !!(process.env.NCBA_API_USERNAME && process.env.NCBA_API_PASSWORD && process.env.NCBA_PAYBILL_NO && process.env.NCBA_ACCOUNT_NO)
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken
  }

  const username = process.env.NCBA_API_USERNAME
  const password = process.env.NCBA_API_PASSWORD
  if (!username || !password) {
    throw new Error('NCBA_API_USERNAME / NCBA_API_PASSWORD not configured')
  }

  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64')
  const res = await fetch(`${BASE_URL}/payments/api/v1/auth/token`, {
    method: 'GET',
    headers: { Authorization: `Basic ${basicAuth}` },
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`NCBA token request failed: ${data.message || res.statusText}`)
  }

  // Refresh a little early (5 min buffer) rather than right at expiry.
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 18000) - 300) * 1000,
  }
  return cachedToken.accessToken
}

// NCBA rejects any TelephoneNo that doesn't include the 254 prefix
// ("Invalid Telephone number, It should include the 254 prefix" - confirmed
// live). A school admin typing their own number on the locked screen will
// naturally type it as 07.../01... most of the time, so normalize instead of
// making that a user-facing error.
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) return `254${digits.slice(1)}`
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return `254${digits}`
  return digits
}

export interface StkPushInitiateResult {
  success: boolean
  transactionId: string | null
  statusCode: string | null
  statusDescription: string | null
  referenceId: string | null
  raw: unknown
}

export async function initiateStkPush(params: {
  telephoneNo: string
  amount: number
}): Promise<StkPushInitiateResult> {
  const paybillNo = process.env.NCBA_PAYBILL_NO
  const accountNo = process.env.NCBA_ACCOUNT_NO
  if (!paybillNo) throw new Error('NCBA_PAYBILL_NO not configured')
  if (!accountNo) throw new Error('NCBA_ACCOUNT_NO not configured')

  const accessToken = await getAccessToken()
  const res = await fetch(`${BASE_URL}/payments/api/v1/stk-push/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      TelephoneNo: normalizeKenyanPhone(params.telephoneNo),
      Amount: String(params.amount),
      PayBillNo: paybillNo,
      AccountNo: accountNo,
      Network: 'Safaricom',
      TransactionType: 'CustomerPayBillOnline',
    }),
  })

  const data = await res.json()
  return {
    success: res.ok && data.StatusCode !== '1',
    transactionId: data.TransactionID ?? null,
    statusCode: data.StatusCode ?? null,
    statusDescription: data.StatusDescription ?? null,
    referenceId: data.ReferenceID ?? null,
    raw: data,
  }
}

// First real use of this (2026-08-13): several real STK pushes were accepted
// by NCBA (confirmed via initiateStkPush's own "Received successfully"
// response) but never triggered a confirmation webhook call, even minutes
// later - so the Push Notification webhook and STK Push results appear to be
// two separate NCBA mechanisms, and this query endpoint is the reliable path
// for STK-initiated payments specifically. Response field casing is
// unconfirmed (initiate's response uses PascalCase like "StatusCode" - this
// endpoint might not), so both are checked defensively rather than assuming
// one.
export async function queryStkPushStatus(transactionId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'UNKNOWN'; description: string; raw: unknown }> {
  const accessToken = await getAccessToken()
  const res = await fetch(`${BASE_URL}/payments/api/v1/stk-push/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ TransactionID: transactionId }),
  })

  const data = await res.json()
  const rawStatus = String(data.status ?? data.Status ?? '').toUpperCase()
  const description = data.description || data.Description || data.StatusDescription || data.ResultDesc || ''
  const descLower = String(description).toLowerCase()

  // Confirmed live: NCBA can return status:"FAILED" with a description that
  // actually means the opposite - "The transaction is still under
  // processing" - if the query lands before the customer has approved (or
  // declined) the prompt yet. The description is the more trustworthy signal
  // here; treat any processing/pending-sounding one as still-unresolved
  // regardless of what the status field claims, so a real success a few
  // seconds later isn't already given up on as a permanent failure.
  const stillProcessing = descLower.includes('processing') || descLower.includes('pending') || descLower.includes('await')

  // Only trust an explicit textual status otherwise - a numeric code here
  // (StatusCode, ResultCode) more likely describes whether the query call
  // itself succeeded, not the underlying payment, and misreading that as
  // "payment succeeded" would be far worse than staying UNKNOWN and polling
  // again.
  const status: 'SUCCESS' | 'FAILED' | 'UNKNOWN' = stillProcessing
    ? 'UNKNOWN'
    : rawStatus.includes('SUCCESS') || rawStatus.includes('COMPLETE') ? 'SUCCESS' :
      rawStatus.includes('FAIL') || rawStatus.includes('CANCEL') || rawStatus.includes('TIMEOUT') || rawStatus.includes('REJECT') ? 'FAILED' :
      'UNKNOWN'
  return { status, description, raw: data }
}
