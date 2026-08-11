import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendRoomAccessGrantedEmail } from '@/lib/email'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Update member fields: company, name, email, default location
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { company_id, individual_hours_allotment, full_name, first_name, last_name, email, default_location_id, seating, is_active } = await request.json()

  const admin = createAdminClient()

  // Get current permitted_email to find old email (needed to look up auth user)
  // and old company_id (needed to recalc office hours if company is changing)
  const { data: current, error: fetchErr } = await admin
    .from('permitted_emails')
    .select('email, company_id, individual_hours_allotment, full_name')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Whichever company will end up in effect after this update — used to
  // decide whether individual_hours_allotment should be allowed to stick.
  const effectiveCompanyId = company_id !== undefined ? (company_id || null) : current.company_id
  const effectiveIndividualHours = effectiveCompanyId
    ? null
    : (individual_hours_allotment !== undefined ? (individual_hours_allotment || null) : current.individual_hours_allotment)
  // They now have a way to book — clear any "please give me room access"
  // request so it stops showing up as outstanding.
  const grantsRoomAccess = !!effectiveCompanyId || !!effectiveIndividualHours
  // Only email if this is the actual moment access turns on, not every
  // edit to an already-connected member.
  const hadAccessBefore = !!current.company_id || !!current.individual_hours_allotment
  const isNewlyGranted = !hadAccessBefore && grantsRoomAccess

  // Build permitted_emails update
  const peUpdate: Record<string, string | number | null | boolean> = {}
  if (company_id           !== undefined) peUpdate.company_id           = company_id || null
  // Individual hours only matter without a company — clear them whenever a
  // company is (or already is) assigned so the two never disagree about
  // where hours live.
  if (individual_hours_allotment !== undefined) peUpdate.individual_hours_allotment = effectiveCompanyId ? null : (individual_hours_allotment || null)
  else if (company_id && !current.company_id) peUpdate.individual_hours_allotment = null // gaining a company clears any individual hours
  if (full_name            !== undefined) peUpdate.full_name            = full_name
  if (first_name           !== undefined) peUpdate.first_name           = first_name
  if (last_name            !== undefined) peUpdate.last_name            = last_name
  if (email                !== undefined) peUpdate.email                = email
  if (default_location_id  !== undefined) peUpdate.default_location_id  = default_location_id ?? null
  if (seating              !== undefined) peUpdate.seating              = seating || null
  if (is_active             !== undefined) peUpdate.is_active            = is_active

  if (Object.keys(peUpdate).length > 0) {
    const { error: peErr } = await admin
      .from('permitted_emails')
      .update(peUpdate)
      .eq('id', id)

    if (peErr) {
      console.error('[admin/members] PATCH permitted_emails error:', peErr.message)
      return NextResponse.json({ error: 'Failed to update member.' }, { status: 500 })
    }
  }

  // Also update profile if the user has an account
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find(u => u.email?.toLowerCase() === current.email?.toLowerCase())

  if (authUser) {
    // Update profile fields
    const profileUpdate: Record<string, string | number | null | boolean> = {}
    if (company_id           !== undefined) profileUpdate.company_id           = company_id || null
    if (individual_hours_allotment !== undefined) profileUpdate.individual_hours_allotment = effectiveCompanyId ? null : (individual_hours_allotment || null)
    else if (company_id && !current.company_id) profileUpdate.individual_hours_allotment = null
    if (full_name            !== undefined) profileUpdate.full_name            = full_name
    if (first_name           !== undefined) profileUpdate.first_name           = first_name
    if (last_name            !== undefined) profileUpdate.last_name            = last_name
    if (default_location_id  !== undefined) profileUpdate.default_location_id  = default_location_id ?? null
    if (seating              !== undefined) profileUpdate.seating              = seating || null
    if (is_active             !== undefined) profileUpdate.is_active            = is_active
    if ((company_id !== undefined || individual_hours_allotment !== undefined) && grantsRoomAccess) {
      profileUpdate.room_access_requested_at = null
    }

    if (Object.keys(profileUpdate).length > 0) {
      await admin.from('profiles').update(profileUpdate).eq('id', authUser.id)
    }

    // Update auth email if changed
    if (email && email !== current.email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(authUser.id, { email })
      if (authErr) {
        console.error('[admin/members] PATCH auth email error:', authErr.message)
        return NextResponse.json({ error: 'Failed to update email.' }, { status: 500 })
      }
    }

    // Let them know they can actually book now — separate from the invite
    // email, and only fires the moment access actually turns on.
    if (isNewlyGranted) {
      try {
        await sendRoomAccessGrantedEmail(email ?? current.email, (full_name ?? current.full_name) || 'there')
      } catch (err) {
        console.error('[admin/members] room-access-granted email failed:', err)
      }
    }
  }


  return NextResponse.json({ ok: true })
}

// Remove member — flags them inactive rather than deleting the record, so
// they move to the inactive list and can be restored later.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  // Get the permitted_email record first
  const { data: pe } = await admin
    .from('permitted_emails')
    .select('email, accepted_at, company_id')
    .eq('id', id)
    .single()

  if (!pe) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // If they have an account, flag the profile inactive too — this hides
  // them from Faces without touching auth.
  if (pe.accepted_at) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUser = users.find(u => u.email?.toLowerCase() === pe.email?.toLowerCase())
    if (authUser) {
      await admin.from('profiles').update({ is_active: false }).eq('id', authUser.id)
    }
  }

  // Flag inactive instead of deleting, so the member moves to the inactive list.
  const { error } = await admin.from('permitted_emails').update({ is_active: false }).eq('id', id)
  if (error) {
    console.error('[admin/members] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
