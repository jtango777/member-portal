import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Update company assignment and/or expected name
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { company_id, full_name } = await request.json()
  if (!company_id && full_name === undefined) {
    return NextResponse.json({ error: 'company_id or full_name required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const update: { company_id?: string; full_name?: string } = {}
  if (company_id) update.company_id = company_id
  if (full_name !== undefined) update.full_name = full_name

  // Update permitted_emails
  const { data: pe, error: peErr } = await admin
    .from('permitted_emails')
    .update(update)
    .eq('id', id)
    .select('email')
    .single()

  if (peErr) {
    console.error('[admin/members] PATCH error:', peErr.message)
    return NextResponse.json({ error: 'Failed to update member.' }, { status: 500 })
  }

  // Also update profile if user has accepted (find profile via auth user lookup)
  if (company_id) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUser = users.find(u => u.email?.toLowerCase() === pe.email?.toLowerCase())
    if (authUser) {
      await admin.from('profiles').update({ company_id }).eq('id', authUser.id)
    }
  }

  return NextResponse.json({ ok: true })
}

// Remove member
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

  // If they have an account, flag it inactive rather than revoking login —
  // this hides them from the roster and Haus Smiles without touching auth.
  if (pe.accepted_at) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUser = users.find(u => u.email?.toLowerCase() === pe.email?.toLowerCase())
    if (authUser) {
      await admin.from('profiles').update({ is_active: false }).eq('id', authUser.id)
    }
  }

  // Delete from permitted_emails
  const { error } = await admin.from('permitted_emails').delete().eq('id', id)
  if (error) {
    console.error('[admin/members] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
