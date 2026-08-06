import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInviteEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'
import { recalcOfficeHours } from '@/lib/officeHours'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { email, company_id, membership_type_id, skipEmail } = await request.json()
  if (!email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  // Company is optional — only needed when this person will share an hour
  // pool with others. Without one, membership_type_id (if given) tracks
  // their own hours individually.
  const companyId = company_id || null
  const membershipTypeId = companyId ? null : (membership_type_id || null)

  const admin = createAdminClient()

  // If this email already had a different company (re-adding/moving someone),
  // grab the old company so we can recalc its office hours too.
  const { data: existing } = await admin.from('permitted_emails').select('company_id').eq('email', email.toLowerCase().trim()).maybeSingle()
  const previousCompanyId = existing?.company_id

  // "Just add" path — creates the record so the person shows up in Members
  // (and can get a photo linked, etc.) without generating an invite link or
  // sending anything. Same "Not invited" state as a fresh Pipedrive import.
  if (skipEmail) {
    // invited_at is NOT NULL with a default — leave it unset so the DB
    // fills in "now" as a plain timestamp, same as any other insert. It's
    // just bookkeeping; invite_token staying null is what actually marks
    // this person as "not invited" anywhere the UI checks that.
    const { error } = await admin.from('permitted_emails').upsert(
      { email: email.toLowerCase().trim(), company_id: companyId, membership_type_id: membershipTypeId, invite_token: null, accepted_at: null },
      { onConflict: 'email' }
    )
    if (error) {
      console.error('[invites/send] error:', error.message)
      return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 })
    }
    await Promise.all([recalcOfficeHours(companyId), recalcOfficeHours(previousCompanyId)])
    return NextResponse.json({ ok: true, emailSent: false, skippedEmail: true })
  }

  const token = generateToken()

  const { error } = await admin.from('permitted_emails').upsert(
    { email: email.toLowerCase().trim(), company_id: companyId, membership_type_id: membershipTypeId, invite_token: token, invited_at: new Date().toISOString(), accepted_at: null },
    { onConflict: 'email' }
  )

  if (error) {
    console.error('[invites/send] error:', error.message)
    return NextResponse.json({ error: 'Failed to create invite.' }, { status: 500 })
  }

  await Promise.all([recalcOfficeHours(companyId), recalcOfficeHours(previousCompanyId)])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${appUrl}/setup-account?token=${token}`
  let emailSent = false

  try {
    await sendInviteEmail(email, token)
    emailSent = true
  } catch (_) {
    // Email failure doesn't block the invite — admin can copy the link manually
  }

  return NextResponse.json({ ok: true, inviteLink, emailSent })
}
