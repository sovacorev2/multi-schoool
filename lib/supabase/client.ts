import { createBrowserClient } from '@supabase/ssr'

// Fallback values when env vars are not available
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dfrggsoruoytsy1jdnif.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcmdnc29ydW95dHN5bGpkbmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDA5MzksImV4cCI6MjA4NTYxNjkzOX0.joHfIet-19ztyB4AV1LLvttvLc1trFxWXeuRGUytTcw'

let cachedClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (cachedClient) {
    return cachedClient
  }

  cachedClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cachedClient
}
