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
    { data: taggedReservations },
  ] = await Promise.all([
    admin.from('permitted_emails').select('*, companies(id, name)').order('invited_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, first_name, last_name, is_admin, company_id, avatar_url, default_location_id, seating, room_access_requested_at, individual_hours_allotment'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    // Every booking with a company on it is a signal for who someone
    // actually belongs to — whether it's tagged to a pending email
    // (historical_email, no account yet) or linked straight to their real
    // account (user_id, e.g. they self-registered and booked before an
    // admin ever set their company). Both cases should surface a suggestion
    // when the member record itself still has no company on file.
    admin.from('reservations').select('user_id, historical_email, company_id, companies(name)').not('company_id', 'is', null),
  ])

  // Build lookup: email → auth user id
  const emailToUserId = Object.fromEntries(
    (authUsers ?? []).map(u => [u.email?.toLowerCase() ?? '', u.id])
  )
  // Build lookup: user id → profile
  const idToProfile = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  )
  // Build lookup: user id → email, so a booking linked directly to a real
  // account (not historical_email) can still be looked up by email below.
  const userIdToEmail = Object.fromEntries(
    (authUsers ?? []).map(u => [u.id, u.email?.toLowerCase() ?? ''])
  )

  // Build lookup: email → most common company from their bookings (either
  // historical_email-tagged, or linked directly via their real account).
  const companyCountsByEmail = new Map<string, Map<string, { count: number; name: string }>>()
  for (const r of taggedReservations ?? []) {
    const email = (r.historical_email ?? userIdToEmail[r.user_id])?.toLowerCase()
    if (!email) continue
    const companyId = r.company_id!
    const companyName = (r.companies as any)?.name ?? ''
    if (companyName === 'External Booking (Legacy)') continue // not a real company, not a useful suggestion
    if (!companyCountsByEmail.has(email)) companyCountsByEmail.set(email, new Map())
    const counts = companyCountsByEmail.get(email)!
    const existing = counts.get(companyId)
    counts.set(companyId, { count: (existing?.count ?? 0) + 1, name: companyName })
  }
  function suggestedCompanyFor(email: string): { id: string; name: string } | null {
    const counts = companyCountsByEmail.get(email.toLowerCase())
    if (!counts) return null
    const [id, { name }] = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0]
    return { id, name }
  }

  const merged = (permittedEmails ?? []).map(pe => {
    const userId  = emailToUserId[pe.email?.toLowerCase() ?? ''] ?? null
    const prof    = userId ? idToProfile[userId] : null
    const companyId = pe.company_id
    const suggested = !companyId ? suggestedCompanyFor(pe.email) : null
    return {
      id:           pe.id,
      email:        pe.email,
      company_id:   companyId,
      company_name: (pe.companies as any)?.name ?? '',
      suggested_company_id:   suggested?.id ?? null,
      suggested_company_name: suggested?.name ?? null,
      individual_hours_allotment: prof?.individual_hours_allotment ?? (pe as any).individual_hours_allotment ?? null,
      invited_at:   pe.invited_at,
      accepted_at:  pe.accepted_at,
      invite_token: pe.invite_token,
      // from profile, falling back to an admin-set expected name while pending
      user_id:      userId,
      full_name:    prof?.full_name ?? pe.full_name ?? null,
      first_name:   prof?.first_name ?? (pe as any).first_name ?? null,
      last_name:    prof?.last_name ?? (pe as any).last_name ?? null,
      is_admin:     prof?.is_admin ?? false,
      avatar_url:          prof?.avatar_url ?? (pe as any).avatar_url ?? null,
      default_location_id: prof?.default_location_id ?? (pe as any).default_location_id ?? null,
      seating:              prof?.seating ?? (pe as any).seating ?? null,
      room_access_requested_at: prof?.room_access_requested_at ?? null,
      is_active:            (pe as any).is_active ?? true,
    }
  })

  return NextResponse.json(merged)
}
