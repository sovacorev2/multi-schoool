import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Fallback values when env vars are not available
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dfrggsoruoytsy1jdnif.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcmdnc29ydW95dHN5bGpkbmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDA5MzksImV4cCI6MjA4NTYxNjkzOX0.joHfIet-19ztyB4AV1LLvttvLc1trFxWXeuRGUytTcw'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
          }
        },
      },
    },
  )
}
