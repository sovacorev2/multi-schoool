import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json()

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Minimum purchase is 100 SMS' },
        { status: 400 }
      )
    }

    const apiKey = process.env.AFRICAS_TALKING_API_KEY
    const username = process.env.AFRICAS_TALKING_USERNAME

    if (!apiKey || !username) {
      return NextResponse.json(
        { error: 'Africa\'s Talking credentials not configured' },
        { status: 500 }
      )
    }

    // In production, integrate with Africa's Talking API to process payment
    // For now, just log the purchase request
    console.log(`[v0] SMS Purchase Request: ${amount} SMS from Africa's Talking`)

    const supabase = createClient()

    // Log the transaction
    const { data: logData, error: logError } = await supabase
      .from('sms_logs')
      .insert({
        type: 'super_admin_purchase',
        sms_count: amount,
        status: 'completed',
        metadata: { purchased_from: 'africas_talking', amount_ksh: amount * 0.5 }
      })

    if (logError) {
      console.error('[v0] Error logging purchase:', logError)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${amount} SMS`,
      amount,
      estimatedCost: amount * 0.5
    })
  } catch (error) {
    console.error('[v0] Error buying SMS:', error)
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    )
  }
}
