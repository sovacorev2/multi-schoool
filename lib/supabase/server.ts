import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Fallback values when env vars are not available
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dfrggsoruoytsy1jdnif.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcmdnc29ydW95dHN5bGpkbmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDA5MzksImV4cCI6MjA4NTYxNjkzOX0.joHfIet-19ztyB4AV1LLvttvLc1trFxWXeuRGUytTcw'

// This file only ever runs server-side (Next.js refuses to bundle it into
// client code), so it's safe to use the service-role key here instead of
// the anon key: every Server Action and API route that calls createClient()
// is trusted app code, not a random browser request, and needs to be able
// to read/write columns that are deliberately locked out of the anon role
// (teacher_accounts.pin, school_credentials.admin_password, etc.) once those
// are restricted at the database level. Falls back to the anon key only if
// the service-role key isn't configured, so local setups without it still
// work for everything that doesn't touch a locked-down column.
//
// Deliberately the plain @supabase/supabase-js client here, not @supabase/
// ssr's createServerClient - that wrapper exists to keep a real Supabase
// Auth session (refreshed via cookies) attached to every request, which is
// worse than useless for a privileged server-only client: this app doesn't
// use Supabase Auth sessions anywhere (its own login flows are all custom,
// via teacher_accounts/schools tables plus this app's own next/headers
// cookies), and in production the cookie-session plumbing was silently
// overriding the service-role key with an anon-level token on every
// request - the key was present and correct (verified directly), but every
// query still ran as anon regardless. A static server-only key has no
// session to refresh or override it with.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
