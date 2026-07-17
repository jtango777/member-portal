import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  const [
    { data: permittedEmails },
    { data: profiles },
    { data: { users: authUsers } },
  ] = await Promise.all([
    admin.from('permitted_emails').select('*, companies(id, name)').order('invited_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, is_admin, company_id, avatar_url, default_location_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  // Build lookup: email → auth user id
  const emailToUserId = Object.fromEntries(
    (authUsers ?? []).map(u => [u.email?.toLowerCase() ?? '', u.id])
  )
  // Build lookup: user id → profile
  const idToProfile = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  )

  const merged = (permittedEmails ?? []).map(pe => {
    const userId  = emailToUserId[pe.email?.toLowerCase() ?? ''] ?? null
    const prof    = userId ? idToProfile[userId] : null
    return {
      id:           pe.id,
      email:        pe.email,
      company_id:   pe.company_id,
      company_name: (pe.companies as any)?.name ?? '',
      invited_at:   pe.invited_at,
      accepted_at:  pe.accepted_at,
      invite_token: pe.invite_token,
      // from profile, falling back to an admin-set expected name while pending
      user_id:      userId,
      full_name:    prof?.full_name ?? pe.full_name ?? null,
      is_admin:     prof?.is_admin ?? false,
      avatar_url:          prof?.avatar_url ?? (pe as any).avatar_url ?? null,
      default_location_id: prof?.default_location_id ?? null,
    }
  })

  return NextResponse.json(merged)
}
