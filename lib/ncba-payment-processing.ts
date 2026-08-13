// Shared "a payment for this school just succeeded" logic - used by both the
// NCBA confirmation webhook and the active status-polling route, since
// STK-initiated payments have turned out to need polling rather than (or in
// addition to) waiting for a webhook call (see lib/ncba-client.ts).

import type { SupabaseClient } from '@supabase/supabase-js'

// How long a successful payment extends access for. Adjust once you know the
// actual term length you're billing for.
const SUBSCRIPTION_EXTENSION_DAYS = 120

export async function applySuccessfulPayment(supabase: SupabaseClient, schoolId: string): Promise<void> {
  const { data: school } = await supabase
    .from('schools')
    .select('id, subscription_expires_at, lock_override')
    .eq('id', schoolId)
    .single()
  if (!school) return

  const now = new Date()
  const currentExpiry = school.subscription_expires_at ? new Date(school.subscription_expires_at) : now
  const extendFrom = currentExpiry > now ? currentExpiry : now
  const newExpiry = new Date(extendFrom.getTime() + SUBSCRIPTION_EXTENSION_DAYS * 24 * 60 * 60 * 1000)

  const updates: Record<string, unknown> = { subscription_expires_at: newExpiry.toISOString() }
  // A successful payment shouldn't silently override an explicit "force locked"
  // super-admin decision - only auto-unlock if there's no override, or the
  // override already says unlocked.
  if (school.lock_override !== false) {
    updates.is_active = true
  }

  await supabase.from('schools').update(updates).eq('id', schoolId)
}
