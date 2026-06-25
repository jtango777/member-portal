import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_REDIRECTS = ['/dashboard', '/dashboard/admin', '/book', '/auth/reset-password']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  const safePath = next.startsWith('/') && !next.startsWith('//') && ALLOWED_REDIRECTS.some(p => next === p || next.startsWith(p + '/'))
    ? next
    : '/dashboard'

  return NextResponse.redirect(`${origin}${safePath}`)
}
