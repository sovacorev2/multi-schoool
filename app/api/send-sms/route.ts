import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductSMSCredits, getSchoolSMSCredits } from '@/lib/sms-credits'

const TEXTSMS_API_KEY = '80a942a47ec152bfc44f39181857fd37'
const TEXTSMS_PARTNER_ID = '16593'
const TEXTSMS_SHORTCODE = 'TextSMS'

export async function POST(req: NextRequest) {
  try {
    const { mobile, message, schoolId } = await req.json()

    if (!mobile || !message) {
      return NextResponse.json({ error: 'mobile and message are required' }, { status: 400 })
    }

    // If schoolId provided, check and deduct SMS credits
    if (schoolId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      try {
        const credits = await getSchoolSMSCredits(supabase, schoolId)
        if (credits.balance < 1) {
          return NextResponse.json(
            { 
              success: false,
              error: `Insufficient SMS credits. Current balance: ${credits.balance}. Purchase more SMS bundles from the admin portal.`
            },
            { status: 402 } // 402 Payment Required
          )
        }
      } catch (error: any) {
        console.error('[send-sms] Credit check error:', error)
        return NextResponse.json(
          { error: 'Failed to verify SMS credits' },
          { status: 500 }
        )
      }
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

    // TextSMS returns "response-code" (with hyphen) in responses array
    const success = response.ok && data?.responses?.[0]?.['response-code'] === 200

    // If successful and schoolId provided, deduct credits
    if (success && schoolId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      try {
        await deductSMSCredits(supabase, schoolId, 1)
        console.log(`[send-sms] Deducted 1 SMS credit for school ${schoolId}`)
      } catch (error: any) {
        console.error('[send-sms] Failed to deduct credits:', error)
        // Don't fail the SMS send if credit deduction fails, but log it
      }
    }

    return NextResponse.json({ success, data })
  } catch (error: any) {
    console.error('[send-sms] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 })
  }
}
