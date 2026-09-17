import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { BOOKING_HOST, PORTAL_HOST, isBookingPath } from '@/lib/hosts'

export async function middleware(request: NextRequest) {
  // ── Which site is this? ───────────────────────────────────────────────
  // Only applies in production, where both hostnames exist. Staging and
  // localhost serve everything on one host and fall straight through.
  const host = request.headers.get('host')?.toLowerCase() ?? ''
  const path = request.nextUrl.pathname
  // The split only switches on once NEXT_PUBLIC_BOOKINGS_URL is set in
  // Vercel — otherwise sending members.bizhaus.com/day-pass to a hostname
  // whose DNS hasn't propagated would take day pass offline (2026-09-17).
  const splitLive = !!process.env.NEXT_PUBLIC_BOOKINGS_URL

  if (splitLive && host === BOOKING_HOST) {
    // The booking site only serves booking pages; anything else (the
    // portal, admin) belongs on members.bizhaus.com.
    if (path === '/') {
      return NextResponse.redirect(new URL('/day-pass', request.url))
    }
    if (!isBookingPath(path) && !path.startsWith('/api') && !path.startsWith('/auth')
        && !path.startsWith('/forgot-password') && !path.startsWith('/_next')
        && path !== '/terms' && path !== '/privacy') {
      return NextResponse.redirect(new URL(path + request.nextUrl.search, `https://${PORTAL_HOST}`))
    }
  } else if (splitLive && host === PORTAL_HOST && isBookingPath(path)) {
    // Old links (confirmation emails sent before the move, printed cards)
    // keep working — send them to the booking site, path intact.
    return NextResponse.redirect(new URL(path + request.nextUrl.search, `https://${BOOKING_HOST}`))
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const publicPaths = ['/login', '/register', '/forgot-password', '/setup-account', '/auth', '/admin-setup', '/api/admin-setup', '/api/invites', '/api/locations', '/book', '/api/book', '/api/stripe/webhook', '/api/webhooks/resend', '/day-pass', '/api/day-pass', '/my-bookings']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  if (!user && !isPublic) {
    // Preserve where they were headed (e.g. a link straight to Members from
    // an email) so login can send them there instead of dropping them on
    // the generic dashboard home.
    const url = request.nextUrl.clone()
    const next = `${pathname}${url.search}`
    url.pathname = '/login'
    url.search = ''
    if (next && next !== '/') url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.searchParams.get('next')
    url.pathname = next && next.startsWith('/') ? next : '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
