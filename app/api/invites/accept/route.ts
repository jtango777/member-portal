import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { passwordError } from '@/lib/password'
import { findAuthUserByEmail } from '@/lib/authLookup'
import { completeMemberSetup } from '@/lib/memberSetup'

export async function POST(request: Request) {
  const { token, first_name, last_name, password, default_location_id, seating, recaptcha_token } = await request.json()

  if (!token || !first_name || !last_name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!(await verifyRecaptcha(recaptcha_token))) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
  }
  const pwErr = passwordError(password)
  if (pwErr) {
    return NextResponse.json({ error: pwErr }, { status: 400 })
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
      console.error('[invites/accept] Auth create error:', authError.message)
      return NextResponse.json({ error: 'Account setup failed. Please try again.' }, { status: 500 })
    }

    // Having a login already is not the same as having the member portal,
    // and until now this route could not tell the difference: it tried to
    // create a login, failed, and gave up. Anyone who had bought a day pass
    // before being invited as a member therefore could never accept the
    // invite — the day pass had already made them a login. Same dead end for
    // anyone archived and re-added. Both cases are now finished properly
    // (Caroline, 2026-10-16).
    //
    // The invite token is what makes this safe: it was emailed to this
    // address and nowhere else, so whoever is holding it controls the
    // mailbox. That is the same proof a password reset runs on, which is why
    // setting the password below is allowed here and not on the token-less
    // /api/invites/accept-by-email route.
    const existing = await findAuthUserByEmail(admin, invite.email)
    if (!existing) {
      console.error('[invites/accept] email_exists but no user found for', invite.email)
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

    const { error: pwUpdateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (pwUpdateError) {
      console.error('[invites/accept] Password set on existing login failed:', pwUpdateError.message)
      return NextResponse.json({ error: 'Account setup failed. Please try again.' }, { status: 500 })
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
