import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Scoped entirely to /requisition/* via the matcher below - the rest of
// this app doesn't use Supabase Auth sessions at all (PIN/admin-password
// based instead), so this must never run for any other route.
const PUBLIC_PATHS = ['/requisition/login']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/requisition/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/requisition/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/requisition'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // The bare /requisition path plus every page under it, except its own
  // API routes - those check auth.getUser() themselves and return a plain
  // 401 JSON response when unauthenticated, which is more appropriate for
  // an API caller than an HTML redirect. /requisition alone needs its own
  // entry since the regex below only matches when there's a trailing
  // /segment.
  matcher: ['/requisition', '/requisition/((?!api/).*)'],
}
