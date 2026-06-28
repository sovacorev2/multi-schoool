import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TEXTSMS_API_KEY = process.env.TEXTSMS_API_KEY || '80a942a47ec152bfc44f39181857fd37'
const TEXTSMS_PARTNER_ID = process.env.TEXTSMS_PARTNER_ID || '16593'
const TEXTSMS_SHORTCODE = 'TextSMS'

async function deductSmsCredits(schoolId: string, smsCount: number): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current credits
  const { data: credits, error: fetchError } = await supabase
    .from('school_sms_credits')
    .select('*')
    .eq('school_id', schoolId)
    .single()

  if (fetchError) throw fetchError

  if (!credits || credits.balance < smsCount) {
    throw new Error(
      `Insufficient SMS credits. Have: ${credits?.balance || 0}, Need: ${smsCount}. ` +
      `Purchase SMS bundles from the admin portal.`
    )
  }

  // Deduct credits
  const { error: updateError } = await supabase
    .from('school_sms_credits')
    .update({
      balance: credits.balance - smsCount,
      total_used: credits.total_used + smsCount
    })
    .eq('school_id', schoolId)

  if (updateError) throw updateError

  // Log usage
  await supabase.from('sms_usage_logs').insert({
    school_id: schoolId,
    recipient_count: 1,
    sms_deducted: smsCount,
    message_preview: null
  })
}

export async function POST(req: NextRequest) {
  try {
    const { mobile, message, schoolId } = await req.json()

    if (!mobile || !message) {
      return NextResponse.json({ error: 'mobile and message are required' }, { status: 400 })
    }

    // Deduct credits if schoolId provided (bulk SMS only)
    if (schoolId) {
      try {
        await deductSmsCredits(schoolId, 1)
      } catch (creditError: any) {
        return NextResponse.json(
          { error: creditError.message || 'Failed to deduct SMS credits' },
          { status: 402 } // 402 Payment Required
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

    // TextSMS returns responses_code 200 on success
    const success = response.ok && (data?.responses?.[0]?.response_code === 200 || data?.response_code === 200 || text.includes('"response_code":200'))

    return NextResponse.json({ success, data })
  } catch (error: any) {
    console.error('[send-sms] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 })
  }
}
