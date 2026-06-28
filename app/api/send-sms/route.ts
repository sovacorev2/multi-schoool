import { NextRequest, NextResponse } from 'next/server'

const TEXTSMS_API_KEY = '80a942a47ec152bfc44f39181857fd37'
const TEXTSMS_PARTNER_ID = '16593'
const TEXTSMS_SHORTCODE = 'TextSMS'

export async function POST(req: NextRequest) {
  try {
    const { mobile, message } = await req.json()

    if (!mobile || !message) {
      return NextResponse.json({ error: 'mobile and message are required' }, { status: 400 })
    }

    // Format phone: ensure it starts with 254 (Kenya)
    const raw = String(mobile).replace(/[^0-9]/g, '')
    const formatted = raw.startsWith('0') ? `254${raw.substring(1)}` : raw.startsWith('254') ? raw : `254${raw}`

    const url = new URL('https://sms.textsms.co.ke/api/services/sendsms/')
    url.searchParams.set('apikey', TEXTSMS_API_KEY)
    url.searchParams.set('partnerID', TEXTSMS_PARTNER_ID)
    url.searchParams.set('message', message)
    url.searchParams.set('shortcode', TEXTSMS_SHORTCODE)
    url.searchParams.set('mobile', formatted)

    const response = await fetch(url.toString())
    const text = await response.text()

    let data: any
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    // TextSMS returns responses_code 200 on success
    const success = response.ok && (data?.responses?.[0]?.response_code === 200 || data?.response_code === 200 || text.includes('"response_code":200'))

    return NextResponse.json({ success, data })
  } catch (error: any) {
    console.error('[send-sms] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 })
  }
}
