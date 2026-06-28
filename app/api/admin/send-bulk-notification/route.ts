import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductSMSCredits, getSchoolSMSCredits } from '@/lib/sms-credits'

const TEXTSMS_API_KEY = '80a942a47ec152bfc44f39181857fd37'
const TEXTSMS_PARTNER_ID = '16593'
const TEXTSMS_SHORTCODE = 'TextSMS'

async function sendSms(phone: string, message: string): Promise<boolean> {
  try {
    const raw = String(phone).replace(/[^0-9]/g, '')
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

    const success = response.ok && data?.responses?.[0]?.['response-code'] === 200
    return success
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, message, classIds } = await req.json()

    if (!schoolId || !message || !classIds || classIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all learners in selected classes with parent phone numbers
    const { data: learners, error } = await supabase
      .from('learners')
      .select('id, name, parent_phone')
      .in('class_id', classIds)
      .eq('school_id', schoolId)
      .not('parent_phone', 'is', null)

    if (error) {
      console.error('[send-bulk-notification] error fetching learners:', error)
      return NextResponse.json({ error: 'Failed to fetch learners' }, { status: 500 })
    }

    if (!learners || learners.length === 0) {
      return NextResponse.json({ error: 'No learners with phone numbers found in selected classes' }, { status: 400 })
    }

    // Deduplicate by phone number (in case parents have multiple children)
    const uniquePhones = new Map<string, string>()
    learners.forEach(learner => {
      if (learner.parent_phone && !uniquePhones.has(learner.parent_phone)) {
        uniquePhones.set(learner.parent_phone, learner.name)
      }
    })

    // Check if school has enough SMS credits
    try {
      const credits = await getSchoolSMSCredits(supabase, schoolId)
      if (credits.balance < uniquePhones.size) {
        return NextResponse.json(
          { 
            success: false,
            error: `Insufficient SMS credits. Need ${uniquePhones.size} SMS, have ${credits.balance}. Purchase more bundles.`
          },
          { status: 402 }
        )
      }
    } catch (error: any) {
      console.error('[send-bulk-notification] Credit check error:', error)
      return NextResponse.json({ error: 'Failed to verify SMS credits' }, { status: 500 })
    }

    // Send SMS to all unique phone numbers
    let successCount = 0
    const failedPhones: string[] = []

    for (const [phone, learnerName] of uniquePhones.entries()) {
      const success = await sendSms(phone, message)
      if (success) {
        successCount++
      } else {
        failedPhones.push(phone)
      }
      // Small delay between sends to avoid rate limiting
      await new Promise(r => setTimeout(r, 100))
    }

    // Deduct SMS credits for successfully sent messages
    try {
      await deductSMSCredits(supabase, schoolId, successCount)
      console.log(`[send-bulk-notification] Deducted ${successCount} SMS credits for school ${schoolId}`)
    } catch (error: any) {
      console.error('[send-bulk-notification] Failed to deduct credits:', error)
      // Don't fail the response if credit deduction fails, but log it
    }

    // Get unique classes for response
    const { data: classData } = await supabase
      .from('classes')
      .select('id')
      .in('id', classIds)
      .eq('school_id', schoolId)

    return NextResponse.json({
      success: true,
      totalRecipients: successCount,
      totalClasses: classIds.length,
      failed: failedPhones.length,
      message: `Sent to ${successCount} parents${failedPhones.length > 0 ? ` (${failedPhones.length} failed)` : ''}`
    })
  } catch (error: any) {
    console.error('[send-bulk-notification] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send notification' }, { status: 500 })
  }
}
