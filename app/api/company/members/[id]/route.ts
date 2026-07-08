import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertCompanyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_company_admin, company_id').eq('id', user.id).single()
  if (!profile || (!profile.is_admin && !profile.is_company_admin) || !profile.company_id) return null
  return { user, companyId: profile.company_id as string }
}

// Remove (flag inactive) a member — only within the caller's own company
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await assertCompanyAdmin()
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = createAdminClient()

  const { data: pe } = await admin.from('permitted_emails').select('email, accepted_at, company_id').eq('id', id).single()
  if (!pe) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (pe.company_id !== caller.companyId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  if (pe.accepted_at) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUser = users.find(u => u.email?.toLowerCase() === pe.email?.toLowerCase())
    if (authUser) {
      await admin.from('profiles').update({ is_active: false }).eq('id', authUser.id)
    }
  }

  const { error } = await admin.from('permitted_emails').delete().eq('id', id)
  if (error) {
    console.error('[company/members] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
