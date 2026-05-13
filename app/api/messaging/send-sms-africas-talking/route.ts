import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Africa's Talking API configuration
const AFRICAS_TALKING_API_KEY = process.env.AFRICAS_TALKING_API_KEY
const AFRICAS_TALKING_USERNAME = process.env.AFRICAS_TALKING_USERNAME
const AFRICAS_TALKING_SENDER_ID = process.env.AFRICAS_TALKING_SENDER_ID || 'SHULECH'

interface SendSMSRequest {
  schoolId: string
  recipients: string[] // Phone numbers
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SendSMSRequest = await request.json()
    const { schoolId, recipients, message } = body

    if (!schoolId || !recipients || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, recipients, message' },
        { status: 400 }
      )
    }

    if (!AFRICAS_TALKING_API_KEY || !AFRICAS_TALKING_USERNAME) {
      return NextResponse.json(
        { error: 'Africa\'s Talking credentials not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Check school SMS credits
    const { data: credits, error: creditsError } = await supabase
      .from('school_sms_credits')
      .select('balance')
      .eq('school_id', schoolId)
      .single()

    if (creditsError || !credits) {
      return NextResponse.json(
        { error: 'School SMS credits not found' },
        { status: 404 }
      )
    }

    // Estimate SMS count (160 chars = 1 SMS, 153 chars = 1 SMS for concatenated)
    const estimatedSmsPerMessage = Math.ceil(message.length / 160)
    const totalSmsNeeded = recipients.length * estimatedSmsPerMessage

    if (credits.balance < totalSmsNeeded) {
      return NextResponse.json(
        {
          error: `Insufficient SMS credits. Need ${totalSmsNeeded}, have ${credits.balance}`,
          creditsNeeded: totalSmsNeeded,
          creditsAvailable: credits.balance
        },
        { status: 402 } // Payment Required
      )
    }

    // Normalize phone numbers to Kenya format
    const normalizedNumbers = recipients.map(num => {
      let normalized = num.replace(/\s/g, '')
      if (normalized.startsWith('0')) {
        normalized = '254' + normalized.substring(1)
      } else if (!normalized.startsWith('254') && !normalized.startsWith('+')) {
        normalized = '254' + normalized
      } else if (normalized.startsWith('+')) {
        normalized = normalized.substring(1)
      }
      return normalized
    })

    console.log('[v0] Sending SMS via Africa\'s Talking:', {
      recipients: normalizedNumbers.length,
      totalSmsNeeded,
      message: message.substring(0, 50) + '...'
    })

    // Send SMS via Africa's Talking API
    const formData = new URLSearchParams()
    formData.append('username', AFRICAS_TALKING_USERNAME)
    formData.append('to', normalizedNumbers.join(','))
    formData.append('message', message)
    if (AFRICAS_TALKING_SENDER_ID) {
      formData.append('from', AFRICAS_TALKING_SENDER_ID)
    }

    const atResponse = await fetch(
      'https://api.africastalking.com/version1/messaging',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'ApiKey': AFRICAS_TALKING_API_KEY
        },
        body: formData
      }
    )

    const atData = await atResponse.json()

    if (!atResponse.ok) {
      console.error('[v0] Africa\'s Talking API error:', atData)
      return NextResponse.json(
        { error: 'Failed to send SMS via Africa\'s Talking', details: atData },
        { status: 500 }
      )
    }

    console.log('[v0] Africa\'s Talking response:', atData)

    // Deduct credits from school balance
    const { error: updateError } = await supabase
      .from('school_sms_credits')
      .update({
        balance: credits.balance - totalSmsNeeded,
        total_used: (await supabase.from('school_sms_credits').select('total_used').eq('school_id', schoolId).single()).data?.total_used || 0 + totalSmsNeeded
      })
      .eq('school_id', schoolId)

    if (updateError) {
      console.error('[v0] Failed to update credits:', updateError)
      // Don't fail the response, SMS was sent successfully
    }

    // Log SMS usage
    await supabase
      .from('sms_usage_logs')
      .insert({
        school_id: schoolId,
        recipient_count: recipients.length,
        sms_count: totalSmsNeeded,
        message_preview: message.substring(0, 100),
        status: 'sent',
        twilio_sid: atData.SMSMessageData?.Message?.[0]?.MessageId || 'unknown'
      })

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
      recipientCount: recipients.length,
      totalSmsUsed: totalSmsNeeded,
      creditsRemaining: credits.balance - totalSmsNeeded,
      africasTalkingResponse: atData
    })
  } catch (error) {
    console.error('[v0] Error sending SMS:', error)
    return NextResponse.json(
      {
        error: 'Failed to send SMS',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
