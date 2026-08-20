import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

// Creates a day-pass customer account — deliberately NOT a member account.
// Same underlying Supabase Auth mechanics as the member invite flow (see
// app/api/invites/accept/route.ts), but writes to booking_customers
// instead of profiles, so this person never shows up as a member or gets
// member-portal access.
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { first_name, last_name, email, password } = await request.json()

  if (!first_name?.trim() || !last_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()

  // Skip email confirmation — they're mid-checkout, not clicking a link
  // days later. Same tradeoff the member invite flow already makes.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  })

  if (authError) {
    // Match on the stable error code, not the message text — Supabase's
    // actual wording ("...has already been registered") doesn't contain
    // the substring "already registered", so a text match silently missed
    // this case and fell through to the generic 500 below.
    if (authError.code === 'email_exists' || authError.message.includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists. Please log in instead.' }, { status: 409 })
    }
    console.error('[day-pass/create-account] Auth create error:', authError.message)
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
  }

  const { error: dbError } = await admin.from('booking_customers').insert({
    id: authData.user.id,
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: normalizedEmail,
  })

  if (dbError) {
    console.error('[day-pass/create-account] DB insert error:', dbError.message)
    // Roll back the auth user so a failed signup doesn't leave an orphaned account.
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, customer_id: authData.user.id })
}
