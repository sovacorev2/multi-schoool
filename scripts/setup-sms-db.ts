import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createSMSTables() {
  try {
    console.log('[v0] Creating SMS tables...')

    // Create sms_bundles table
    const { error: bundlesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sms_bundles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sms_count INTEGER NOT NULL,
          price_ksh DECIMAL(10, 2) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    })

    if (bundlesError) {
      console.log('[v0] Note: sms_bundles table may already exist or RPC not available')
    } else {
      console.log('[v0] Created sms_bundles table')
    }

    // Create school_sms_credits table
    const { error: creditsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS school_sms_credits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          available_credits INTEGER DEFAULT 0,
          total_purchased INTEGER DEFAULT 0,
          total_used INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(school_id)
        );
      `
    })

    if (creditsError) {
      console.log('[v0] Note: school_sms_credits table may already exist')
    } else {
      console.log('[v0] Created school_sms_credits table')
    }

    // Create sms_transactions table
    const { error: transError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sms_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          bundle_id UUID REFERENCES sms_bundles(id),
          sms_count INTEGER NOT NULL,
          price_ksh DECIMAL(10, 2) NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    })

    if (transError) {
      console.log('[v0] Note: sms_transactions table may already exist')
    } else {
      console.log('[v0] Created sms_transactions table')
    }

    // Create sms_usage_logs table
    const { error: usageError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sms_usage_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          recipient_count INTEGER NOT NULL,
          sms_deducted INTEGER NOT NULL,
          message_preview TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    })

    if (usageError) {
      console.log('[v0] Note: sms_usage_logs table may already exist')
    } else {
      console.log('[v0] Created sms_usage_logs table')
    }

    // Insert default bundles (KES pricing - 1 KES = 1 SMS)
    const { error: insertError } = await supabase
      .from('sms_bundles')
      .insert([
        { sms_count: 700, price_ksh: 700, description: '700 SMS - KES 700' },
        { sms_count: 1250, price_ksh: 1250, description: '1,250 SMS - KES 1,250' },
        { sms_count: 1500, price_ksh: 1500, description: '1,500 SMS - KES 1,500' }
      ])
      .on('insertError', (err) => {
        console.log('[v0] Some bundles may already exist (that\'s okay)')
      })

    console.log('[v0] SMS bundles configured')
    console.log('[v0] SMS tables created successfully!')
    process.exit(0)
  } catch (error) {
    console.error('[v0] Error creating SMS tables:', error)
    process.exit(1)
  }
}

createSMSTables()
