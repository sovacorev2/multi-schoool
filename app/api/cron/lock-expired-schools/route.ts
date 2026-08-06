import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Daily: lock any school whose subscription_expires_at has passed, and unlock any
// school that's within its paid period - unless a super-admin has set an explicit
// lock_override (true = always unlocked, false = always locked), which always wins.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const nowIso = new Date().toISOString()

    // Lock: expired, and not explicitly forced unlocked.
    const { data: locked, error: lockError } = await supabase
      .from('schools')
      .update({ is_active: false })
      .lt('subscription_expires_at', nowIso)
      .not('subscription_expires_at', 'is', null)
      .or('lock_override.is.null,lock_override.eq.false')
      .neq('is_active', false)
      .select('id, name')

    if (lockError) {
      console.error('[lock-expired-schools] Error locking schools:', lockError)
    }

    // Unlock: within paid period (or no expiry set = never auto-locked), and not
    // explicitly forced locked.
    const { data: unlocked, error: unlockError } = await supabase
      .from('schools')
      .update({ is_active: true })
      .or(`subscription_expires_at.is.null,subscription_expires_at.gte.${nowIso}`)
      .or('lock_override.is.null,lock_override.eq.true')
      .neq('is_active', true)
      .select('id, name')

    if (unlockError) {
      console.error('[lock-expired-schools] Error unlocking schools:', unlockError)
    }

    return NextResponse.json({
      message: 'Processed',
      lockedCount: locked?.length || 0,
      lockedSchools: locked?.map(s => s.name) || [],
      unlockedCount: unlocked?.length || 0,
      unlockedSchools: unlocked?.map(s => s.name) || [],
    })
  } catch (error) {
    console.error('[lock-expired-schools] Cron job error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}
