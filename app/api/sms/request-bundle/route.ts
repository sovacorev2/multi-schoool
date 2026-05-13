import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { bundle_id } = await request.json()
    const schoolId = request.headers.get('x-school-id')

    if (!schoolId || !bundle_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Create transaction request
    const { data: transaction, error } = await supabase
      .from('sms_transactions')
      .insert({
        school_id: schoolId,
        bundle_id: bundle_id,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
    }

    console.log('[v0] SMS bundle request created:', transaction.id)

    return NextResponse.json({
      success: true,
      message: 'Bundle request sent. Waiting for super admin approval.',
      transaction
    })
  } catch (error) {
    console.error('[v0] Error requesting bundle:', error)
    return NextResponse.json({ error: 'Failed to request bundle' }, { status: 500 })
  }
}
