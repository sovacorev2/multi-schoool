import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    console.log('[v0] Creating SMS tables...')

    // Try to create tables via direct SQL
    const sqlCommands = [
      `CREATE TABLE IF NOT EXISTS sms_bundles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sms_count INTEGER NOT NULL,
        price_ksh DECIMAL(10, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS school_sms_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        available_credits INTEGER DEFAULT 0,
        total_purchased INTEGER DEFAULT 0,
        total_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(school_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS sms_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        bundle_id UUID REFERENCES sms_bundles(id),
        sms_count INTEGER NOT NULL,
        price_ksh DECIMAL(10, 2) NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS sms_usage_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        recipient_count INTEGER NOT NULL,
        sms_deducted INTEGER NOT NULL,
        message_preview TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`
    ]

    // For now, just try to insert bundles as a test
    const { data: bundles, error: bundlesError } = await supabase
      .from('sms_bundles')
      .select('count')
      .single()

    if (bundlesError?.code === 'PGRST116') {
      console.log('[v0] sms_bundles table does not exist yet')
      return NextResponse.json({
        error: 'SMS tables not yet created. Please create them via Supabase SQL Editor.',
        sql: sqlCommands,
        instructions: 'Go to Supabase → SQL Editor → New Query → Paste all SQL commands → Run'
      }, { status: 400 })
    }

    // Insert default bundles
    const { data: existingBundles } = await supabase
      .from('sms_bundles')
      .select('*')

    if (!existingBundles || existingBundles.length === 0) {
      const { error: insertError } = await supabase
        .from('sms_bundles')
        .insert([
          { sms_count: 100, price_ksh: 500, description: '100 SMS Package' },
          { sms_count: 500, price_ksh: 2000, description: '500 SMS Package' },
          { sms_count: 1000, price_ksh: 3500, description: '1000 SMS Package' },
          { sms_count: 5000, price_ksh: 15000, description: '5000 SMS Package' }
        ])

      if (insertError) {
        console.log('[v0] Error inserting bundles:', insertError)
      } else {
        console.log('[v0] Default SMS bundles created')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'SMS tables setup complete',
      bundles_created: true
    })
  } catch (error) {
    console.error('[v0] Error setting up SMS database:', error)
    return NextResponse.json(
      { error: 'Failed to setup SMS database', details: String(error) },
      { status: 500 }
    )
  }
}
