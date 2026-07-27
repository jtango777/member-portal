import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  const { company_id, full_name, email, default_location_id, is_active } = await request.json()

  const admin = createAdminClient()

  // Get current permitted_email to find old email (needed to look up auth user)
  const { data: current, error: fetchErr } = await admin
    .from('permitted_emails')
    .select('email')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Build permitted_emails update
  const peUpdate: Record<string, string | null | boolean> = {}
  if (company_id           !== undefined) peUpdate.company_id           = company_id
  if (full_name            !== undefined) peUpdate.full_name            = full_name
  if (email                !== undefined) peUpdate.email                = email
  if (default_location_id  !== undefined) peUpdate.default_location_id  = default_location_id ?? null
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
    if (company_id           !== undefined) profileUpdate.company_id           = company_id
    if (full_name            !== undefined) profileUpdate.full_name            = full_name
    if (default_location_id  !== undefined) profileUpdate.default_location_id  = default_location_id ?? null
    if (is_active             !== undefined) profileUpdate.is_active            = is_active

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
    .select('email, accepted_at')
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
