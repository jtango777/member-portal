import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInviteEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'
import { markCurrentMemberInPipedrive, syncLocationAndSeatingToPipedrive } from '@/lib/pipedrive'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { email, first_name, last_name, company_id, individual_hours_allotment, default_location_id, seating, skipEmail, markInPipedrive } = await request.json()
  if (!email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  // Company is optional — only needed when this person will share an hour
  // pool with others. Without one, individual_hours_allotment (if given)
  // tracks their own hours individually.
  const companyId = company_id || null
  const individualHours = companyId ? null : (individual_hours_allotment || null)
  const locationId = default_location_id || null
  const seatingValue = seating || null
  const firstName = first_name?.trim() || null
  const lastName = last_name?.trim() || null
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  const admin = createAdminClient()

  // Refuse outright if this address is sitting in the archive.
  //
  // Both paths below upsert on email, which quietly updated the archived
  // row and left is_active false. The admin saw "invite sent", the person
  // got an email, clicked it, and was told "an account with this email
  // already exists" — because archiving never removes their login. Nothing
  // anywhere said the person was archived, so whoever added them had no way
  // to work out what had happened (Caroline, 2026-10-16).
  const { data: archived } = await admin
    .from('permitted_emails')
    .select('id, full_name, email')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', false)
    .maybeSingle()

  if (archived) {
    const who = archived.full_name ?? archived.email
    return NextResponse.json({
      error: `${who} is archived, not new. Restore them from Show Archived Members instead — adding them again sends an invite they cannot accept, because their old login still exists.`,
      archived: true,
      member_id: archived.id,
    }, { status: 409 })
  }

  // Looked up once, used by the Pipedrive sync below in both branches —
  // the portal stores a location id, but Pipedrive's "Location Desired"
  // field is keyed by name.
  let locationName: string | null = null
  if (locationId) {
    const { data: location } = await admin.from('locations').select('name').eq('id', locationId).single()
    locationName = location?.name ?? null
  }

  // "Just add" path — creates the record so the person shows up in Members
  // (and can get a photo linked, etc.) without generating an invite link or
  // sending anything. Same "Not invited" state as a fresh Pipedrive import.
  if (skipEmail) {
    // invited_at is NOT NULL with a default — leave it unset so the DB
    // fills in "now" as a plain timestamp, same as any other insert. It's
    // just bookkeeping; invite_token staying null is what actually marks
    // this person as "not invited" anywhere the UI checks that.
    const { data: row, error } = await admin.from('permitted_emails').upsert(
      { email: email.toLowerCase().trim(), first_name: firstName, last_name: lastName, full_name: fullName, company_id: companyId, individual_hours_allotment: individualHours, default_location_id: locationId, seating: seatingValue, invite_token: null, accepted_at: null },
      { onConflict: 'email' }
    ).select('id').single()
    if (error) {
      console.error('[invites/send] error:', error.message)
      return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 })
    }

    let pipedriveMatched: boolean | null = null
    if (markInPipedrive !== false) {
      const result = await markCurrentMemberInPipedrive(email)
      if (!result.ok) console.error('[invites/send] Pipedrive mark failed:', result.error)
      else pipedriveMatched = result.matched

      const syncResult = await syncLocationAndSeatingToPipedrive(email, { locationName, seating: seatingValue })
      if (!syncResult.ok) console.error('[invites/send] Pipedrive location/seating sync failed:', syncResult.error)
    }

    return NextResponse.json({ ok: true, emailSent: false, skippedEmail: true, pipedriveMatched, member_id: row.id })
  }

  const token = generateToken()

  const { data: row, error } = await admin.from('permitted_emails').upsert(
    { email: email.toLowerCase().trim(), first_name: firstName, last_name: lastName, full_name: fullName, company_id: companyId, individual_hours_allotment: individualHours, default_location_id: locationId, seating: seatingValue, invite_token: token, invited_at: new Date().toISOString(), accepted_at: null, email_status: null, email_status_reason: null, email_status_at: null },
    { onConflict: 'email' }
  ).select('id').single()

  if (error) {
    console.error('[invites/send] error:', error.message)
    return NextResponse.json({ error: 'Failed to create invite.' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${appUrl}/setup-account?token=${token}`
  let emailSent = false

  try {
    await sendInviteEmail(email, token)
    emailSent = true
  } catch (_) {
    // Email failure doesn't block the invite — admin can copy the link manually
  }

  let pipedriveMatched: boolean | null = null
  if (markInPipedrive !== false) {
    const result = await markCurrentMemberInPipedrive(email)
    if (!result.ok) console.error('[invites/send] Pipedrive mark failed:', result.error)
    else pipedriveMatched = result.matched

    const syncResult = await syncLocationAndSeatingToPipedrive(email, { locationName, seating: seatingValue })
    if (!syncResult.ok) console.error('[invites/send] Pipedrive location/seating sync failed:', syncResult.error)
  }

  return NextResponse.json({ ok: true, inviteLink, emailSent, pipedriveMatched, member_id: row.id })
}
