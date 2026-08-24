import { createClient } from '@supabase/supabase-js'

// Service-role client for the two requisition webhook routes only - they're
// called by Supabase itself (not a logged-in user), so they need to read
// across RLS to look up requester/approver/decider profiles. Never import
// this into client-visible code.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
