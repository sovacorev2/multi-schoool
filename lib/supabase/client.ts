import { createBrowserClient } from '@supabase/ssr'

// Get values from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

let cachedClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (cachedClient) {
    return cachedClient
  }

  cachedClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cachedClient
}
