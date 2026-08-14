import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificMonthBounds } from '@/lib/utils'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month param required' }, { status: 400 })

  const { start, end } = getPacificMonthBounds(month)

  const admin = createAdminClient()

  const [
    { data: permittedEmails },
    { data: profiles },
    { data: { users: authUsers } },
    { data: reservations },
  ] = await Promise.all([
    admin.from('permitted_emails').select('email, company_id, default_location_id, companies(id, name)'),
    admin.from('profiles').select('id, full_name, company_id, default_location_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('reservations')
      .select('user_id, start_time, end_time, historical_email')
      .gte('start_time', start)
      .lt('start_time', end),
  ])

  // Build lookup: email → auth user
  const emailToUser = Object.fromEntries(
    (authUsers ?? []).map(u => [u.email?.toLowerCase() ?? '', u])
  )
  // Build lookup: user id → profile
  const idToProfile = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  )
  // Build lookup: user id → reservation hours (bookings already tied to a
  // real account)
  const userHours: Record<string, { hours: number; count: number }> = {}
  // Build lookup: email → reservation hours (bookings tagged to a pending
  // member who hasn't signed up yet — still theirs, just no account yet).
  // Once they join, the reassignment at signup moves these into userHours
  // instead, so this stays accurate either way.
  const emailHours: Record<string, { hours: number; count: number }> = {}
  for (const r of reservations ?? []) {
    const hrs = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000
    if (r.historical_email) {
      const key = r.historical_email.toLowerCase()
      if (!emailHours[key]) emailHours[key] = { hours: 0, count: 0 }
      emailHours[key].hours += hrs
      emailHours[key].count += 1
    } else {
      if (!userHours[r.user_id]) userHours[r.user_id] = { hours: 0, count: 0 }
      userHours[r.user_id].hours += hrs
      userHours[r.user_id].count += 1
    }
  }

  const result = (permittedEmails ?? []).map(pe => {
    const authUser = emailToUser[pe.email?.toLowerCase() ?? '']
    const userId   = authUser?.id ?? null
    const prof     = userId ? idToProfile[userId] : null
    // Signed-up members use their real booking history; pending members
    // (no account yet) get credit for bookings already tagged to their
    // email, so the hours are already accounted for the moment they join.
    const usage    = userId ? userHours[userId] : emailHours[pe.email?.toLowerCase() ?? '']

    return {
      user_id:           userId,
      email:             pe.email,
      full_name:         prof?.full_name ?? null,
      company_id:        pe.company_id,
      company_name:      (pe.companies as Record<string, unknown>)?.name ?? '',
      hours_used:          Math.round((usage?.hours ?? 0) * 10) / 10,
      reservation_count:   usage?.count ?? 0,
      // Most members here are still "pending" (added by an admin, no
      // account yet) — prof is null for those, so their location has to
      // come from the permitted_emails preset instead of the (nonexistent)
      // profile. Once they sign up, prof.default_location_id takes over.
      default_location_id: prof?.default_location_id ?? pe.default_location_id ?? null,
    }
  })

  return NextResponse.json(result)
}
