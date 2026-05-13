import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Twilio SDK
const twilio = require('twilio')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipients, message, schoolId, messageType = 'bulk' } = body

    if (!recipients || recipients.length === 0 || !message || !schoolId) {
      return NextResponse.json(
        { error: 'Missing required fields: recipients, message, schoolId' },
        { status: 400 }
      )
    }

    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[v0] Twilio credentials not configured')
      return NextResponse.json(
        { error: 'SMS service not configured. Contact system administrator.' },
        { status: 500 }
      )
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Get school info for logging
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()

    console.log('[v0] Sending SMS from school:', school?.name)
    console.log('[v0] SMS Recipients:', recipients.length)
    console.log('[v0] Message type:', messageType)

    // Send SMS to each recipient
    const results = []
    let successCount = 0
    let failureCount = 0

    for (const recipient of recipients) {
      try {
        const phoneNumber = recipient.phone || recipient.mobile
        
        if (!phoneNumber) {
          console.warn('[v0] No phone number for recipient:', recipient.name)
          failureCount++
          continue
        }

        // Ensure phone number is in international format
        let formattedNumber = phoneNumber.toString().trim()
        if (!formattedNumber.startsWith('+')) {
          // If it doesn't start with +, assume it's a Kenya number and add +254
          if (formattedNumber.startsWith('0')) {
            formattedNumber = '+254' + formattedNumber.substring(1)
          } else {
            formattedNumber = '+254' + formattedNumber
          }
        }

        const smsMessage = await client.messages.create({
          body: message,
          from: fromNumber,
          to: formattedNumber,
        })

        successCount++
        results.push({
          recipient: recipient.name,
          phone: formattedNumber,
          status: 'sent',
          messageId: smsMessage.sid,
        })

        console.log('[v0] SMS sent to:', formattedNumber, 'Message ID:', smsMessage.sid)
      } catch (err) {
        failureCount++
        const error = err as Error
        console.error('[v0] Failed to send SMS:', error.message)
        results.push({
          recipient: recipient.name,
          phone: recipient.phone || recipient.mobile,
          status: 'failed',
          error: error.message,
        })
      }
    }

    // Log the bulk SMS in database for audit trail
    if (successCount > 0) {
      await supabase
        .from('sms_logs')
        .insert({
          school_id: schoolId,
          message_type: messageType,
          recipient_count: recipients.length,
          success_count: successCount,
          failure_count: failureCount,
          message: message.substring(0, 500), // Store first 500 chars
          created_at: new Date().toISOString(),
        })
    }

    return NextResponse.json({
      success: true,
      message: `SMS sent successfully`,
      stats: {
        total: recipients.length,
        sent: successCount,
        failed: failureCount,
      },
      results,
    })
  } catch (error) {
    console.error('[v0] SMS sending error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
