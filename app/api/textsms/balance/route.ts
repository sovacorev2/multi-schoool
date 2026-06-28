import { NextRequest, NextResponse } from 'next/server'

const TEXTSMS_API_KEY = '80a942a47ec152bfc44f39181857fd37'
const TEXTSMS_PARTNER_ID = '16593'

/**
 * Fetch TextSMS account balance
 * Returns the current SMS credit balance from TextSMS.co.ke
 */
export async function GET(req: NextRequest) {
  try {
    // TextSMS balance check endpoint
    const url = new URL('https://sms.textsms.co.ke/api/services/getbalanc/')
    url.searchParams.set('apikey', TEXTSMS_API_KEY)
    url.searchParams.set('partnerID', TEXTSMS_PARTNER_ID)

    const response = await fetch(url.toString())
    const text = await response.text()

    let data: any
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    console.log('[textsms-balance] Response:', { status: response.status, data })

    // TextSMS returns balance in responses array
    const balance = data?.responses?.[0]?.balance || 0

    return NextResponse.json({
      success: response.ok,
      balance: parseFloat(balance) || 0,
      data
    })
  } catch (error: any) {
    console.error('[textsms-balance] error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch TextSMS balance' },
      { status: 500 }
    )
  }
}
