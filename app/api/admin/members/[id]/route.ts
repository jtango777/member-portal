import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { recalcOfficeHours } from '@/lib/officeHours'

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

  const { company_id, membership_type_id, full_name, email, default_location_id, seating, is_active } = await request.json()

  const admin = createAdminClient()

  // Get current permitted_email to find old email (needed to look up auth user)
  // and old company_id (needed to recalc office hours if company is changing)
  const { data: current, error: fetchErr } = await admin
    .from('permitted_emails')
    .select('email, company_id, membership_type_id')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Whichever company will end up in effect after this update — used to
  // decide whether membership_type_id should be allowed to stick.
  const effectiveCompanyId = company_id !== undefined ? (company_id || null) : current.company_id
  const effectiveMembershipTypeId = effectiveCompanyId
    ? null
    : (membership_type_id !== undefined ? (membership_type_id || null) : current.membership_type_id)
  // They now have a way to book — clear any "please give me room access"
  // request so it stops showing up as outstanding.
  const grantsRoomAccess = !!effectiveCompanyId || !!effectiveMembershipTypeId

  // Build permitted_emails update
  const peUpdate: Record<string, string | null | boolean> = {}
  if (company_id           !== undefined) peUpdate.company_id           = company_id || null
  // Membership type only matters without a company — clear it whenever a
  // company is (or already is) assigned so the two never disagree about
  // where hours live.
  if (membership_type_id   !== undefined) peUpdate.membership_type_id   = effectiveCompanyId ? null : (membership_type_id || null)
  else if (company_id && !current.company_id) peUpdate.membership_type_id = null // gaining a company clears any individual membership type
  if (full_name            !== undefined) peUpdate.full_name            = full_name
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
    const profileUpdate: Record<string, string | null | boolean> = {}
    if (company_id           !== undefined) profileUpdate.company_id           = company_id || null
    if (membership_type_id   !== undefined) profileUpdate.membership_type_id   = effectiveCompanyId ? null : (membership_type_id || null)
    else if (company_id && !current.company_id) profileUpdate.membership_type_id = null
    if (full_name            !== undefined) profileUpdate.full_name            = full_name
    if (default_location_id  !== undefined) profileUpdate.default_location_id  = default_location_id ?? null
    if (seating              !== undefined) profileUpdate.seating              = seating || null
    if (is_active             !== undefined) profileUpdate.is_active            = is_active
    if ((company_id !== undefined || membership_type_id !== undefined) && grantsRoomAccess) {
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
  }

  // Recalc office hours for whichever company(s) could have changed headcount:
  // the new company (if moved/changed), the old one, or the same one if just
  // is_active flipped.
  if (company_id !== undefined || is_active !== undefined) {
    await Promise.all([recalcOfficeHours(effectiveCompanyId), recalcOfficeHours(current.company_id)])
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

  await recalcOfficeHours(pe.company_id)

  return NextResponse.json({ ok: true })
}
