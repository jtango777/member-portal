import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyRecaptcha } from '@/lib/recaptcha'

export async function POST(request: Request) {
  const { token, name, password, default_location_id, recaptcha_token } = await request.json()

  if (!token || !name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!(await verifyRecaptcha(recaptcha_token))) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify token
  const { data: invite } = await admin
    .from('permitted_emails')
    .select('*')
    .eq('invite_token', token)
    .single()

  if (!invite || invite.accepted_at) {
    return NextResponse.json({ error: 'Invalid or already-used invite link.' }, { status: 400 })
  }

  // Create auth user (skip email confirmation since they validated via invite token)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:          invite.email,
    password,
    email_confirm:  true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    console.error('[invites/accept] Auth create error:', authError.message)
    return NextResponse.json({ error: 'Account setup failed. Please try again.' }, { status: 500 })
  }

  const userId = authData.user!.id

  // Create profile
  await admin.from('profiles').insert({
    id:                  userId,
    company_id:          invite.company_id,
    individual_hours_allotment: invite.individual_hours_allotment ?? null,
    full_name:           name.trim(),
    is_admin:            false,
    default_location_id: default_location_id ?? invite.default_location_id ?? null,
    avatar_url:          invite.avatar_url ?? null,
    seating:             invite.seating ?? null,
  })

  // Mark invite as accepted
  await admin
    .from('permitted_emails')
    .update({ accepted_at: new Date().toISOString(), invite_token: null })
    .eq('id', invite.id)

  // Reassign any historical (pre-signup) bookings tagged with this email to
  // the real account they just created.
  await admin
    .from('reservations')
    .update({ user_id: userId, historical_email: null })
    .ilike('historical_email', invite.email)

  return NextResponse.json({ ok: true })
}
