import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { passwordError } from '@/lib/password'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { findAuthUserByEmail, passwordMatches } from '@/lib/authLookup'
import { completeMemberSetup } from '@/lib/memberSetup'

export async function POST(request: Request) {
  const { email, first_name, last_name, password, default_location_id, seating, recaptcha_token } = await request.json()

  if (!email || !first_name || !last_name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  // This route creates a real account from just an email address, with
  // nothing else rate-limiting or bot-checking it — /api/invites/accept
  // (the invite-link path) has always required this; this one was built
  // separately and never got it added. Caught 2026-09-11.
  if (!(await verifyRecaptcha(recaptcha_token))) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
  }
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('permitted_emails')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!invite || invite.accepted_at) {
    return NextResponse.json({ error: 'This email is not recognized, or already has an account.' }, { status: 400 })
  }

  // Checked before creating anything, but NOT when they already have a
  // login below: there the password is one they set long ago, possibly
  // under day pass signup's looser 8-character rule, and refusing it for
  // failing today's rules would leave them with no way in at all.
  if (!(await findAuthUserByEmail(admin, invite.email))) {
    const pwErr = passwordError(password)
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
  })

  let userId: string

  if (authError) {
    // Match on the stable error code, not the message text — Supabase's
    // actual wording ("...has already been registered") does not contain
    // the substring "already registered", so this test never fired and
    // everyone who already had a login fell through to the generic
    // "Account setup failed. Please try again." below.
    const alreadyHasLogin =
      authError.code === 'email_exists' || authError.message.includes('already registered')

    if (!alreadyHasLogin) {
      console.error('[invites/accept-by-email] Auth create error:', authError.message)
      return NextResponse.json({ error: 'Account setup failed. Please try again.' }, { status: 500 })
    }

    // Someone who bought a day pass before being invited as a member already
    // has a login, so the member portal could never be set up for them: this
    // route tried to create a second login on the same address and stopped
    // there. Now it attaches the portal to the login they have.
    //
    // Unlike /api/invites/accept there is no emailed token here — this route
    // identifies people by typed-in email address alone. So it asks for the
    // password they already have rather than setting a new one: without that
    // check, anyone who knew a member's email address could take their
    // account over from the public /register page (Caroline, 2026-10-16).
    const existing = await findAuthUserByEmail(admin, invite.email)
    if (!existing) {
      console.error('[invites/accept-by-email] email_exists but no user found for', invite.email)
      return NextResponse.json({ error: 'Account setup failed. Please try again.' }, { status: 500 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', existing.id)
      .maybeSingle()

    if (profile) {
      return NextResponse.json({
        error: 'You already have a BizHaus member account with this email. Sign in instead, or use "Forgot password" if you cannot remember your password.',
      }, { status: 409 })
    }

    if (!(await passwordMatches(invite.email, password))) {
      return NextResponse.json({
        error: 'You already have a BizHaus login with this email, from booking a day pass or a room. Enter that same password here to add the member portal to it, or use "Forgot password" on the sign-in page if you cannot remember it.',
      }, { status: 409 })
    }

    userId = existing.id
  } else {
    userId = authData!.user!.id
  }

  await completeMemberSetup({
    admin,
    userId,
    invite,
    firstName: first_name,
    lastName: last_name,
    defaultLocationId: default_location_id,
    seating,
  })

  return NextResponse.json({ ok: true })
}
