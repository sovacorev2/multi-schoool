import { createBrowserClient } from '@supabase/ssr'

// Get values from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let cachedClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Validate that we have credentials (only fail at runtime, not at build time)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (typeof window !== 'undefined') {
      // At runtime, throw if missing
      throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    // During build, return a dummy client
    return createBrowserClient('https://dummy.supabase.co', 'dummy-key')
  }

  if (cachedClient) {
    return cachedClient
  }

  cachedClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cachedClient
}
