// NCBA Till STK Push client - server-side only. Never import this from a 'use
// client' component; the credentials below must never reach the browser.
//
// Requires these env vars (server-only, no NEXT_PUBLIC_ prefix):
//   NCBA_API_USERNAME       - Basic Auth username for token generation
//   NCBA_API_PASSWORD       - Basic Auth password for token generation
//   NCBA_PAYBILL_NO         - the PayBillNo used for every STK Push (e.g. 880100)
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
  return !!(process.env.NCBA_API_USERNAME && process.env.NCBA_API_PASSWORD && process.env.NCBA_PAYBILL_NO)
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
  accountNo: string // used to attribute the payment back to a school
}): Promise<StkPushInitiateResult> {
  const paybillNo = process.env.NCBA_PAYBILL_NO
  if (!paybillNo) throw new Error('NCBA_PAYBILL_NO not configured')

  const accessToken = await getAccessToken()
  const res = await fetch(`${BASE_URL}/payments/api/v1/stk-push/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      TelephoneNo: params.telephoneNo,
      Amount: String(params.amount),
      PayBillNo: paybillNo,
      AccountNo: params.accountNo,
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

export async function queryStkPushStatus(transactionId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'UNKNOWN'; description: string }> {
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
  const status = data.status === 'SUCCESS' ? 'SUCCESS' : data.status === 'FAILED' ? 'FAILED' : 'UNKNOWN'
  return { status, description: data.description || '' }
}
