import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { recalcOfficeHours } from '@/lib/officeHours'

// Permanently deletes an already-archived member — the record, their auth
// account, and their bookings. Unlike DELETE on the base member route
// (which just flags is_active=false so they can be restored), this cannot
// be undone. Only ever called from the Archived Members "Permanently
// Remove" action, and only on members that are already archived.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  const { data: pe } = await admin
    .from('permitted_emails')
    .select('email, company_id, is_active')
    .eq('id', id)
    .single()

  if (!pe) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (pe.is_active) {
    return NextResponse.json({ error: 'Archive this member first before permanently removing them.' }, { status: 400 })
  }

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find(u => u.email?.toLowerCase() === pe.email?.toLowerCase())

  if (authUser) {
    await admin.from('reservations').delete().eq('user_id', authUser.id)
    await admin.from('profiles').delete().eq('id', authUser.id)
    const { error: authErr } = await admin.auth.admin.deleteUser(authUser.id)
    if (authErr) {
      console.error('[members/purge] auth delete error:', authErr.message)
      return NextResponse.json({ error: 'Failed to delete the login account.' }, { status: 500 })
    }
  }

  const { error } = await admin.from('permitted_emails').delete().eq('id', id)
  if (error) {
    console.error('[members/purge] permitted_emails delete error:', error.message)
    return NextResponse.json({ error: 'Failed to permanently remove member.' }, { status: 500 })
  }

  await recalcOfficeHours(pe.company_id)

  return NextResponse.json({ ok: true })
}
