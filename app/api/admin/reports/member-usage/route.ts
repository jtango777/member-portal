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
    admin.from('permitted_emails').select('email, company_id, companies(id, name)'),
    admin.from('profiles').select('id, full_name, company_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('reservations')
      .select('user_id, start_time, end_time')
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
  // Build lookup: user id → reservation hours
  const userHours: Record<string, { hours: number; count: number }> = {}
  for (const r of reservations ?? []) {
    if (!userHours[r.user_id]) userHours[r.user_id] = { hours: 0, count: 0 }
    userHours[r.user_id].hours += (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000
    userHours[r.user_id].count += 1
  }

  const result = (permittedEmails ?? []).map(pe => {
    const authUser = emailToUser[pe.email?.toLowerCase() ?? '']
    const userId   = authUser?.id ?? null
    const prof     = userId ? idToProfile[userId] : null
    const usage    = userId ? userHours[userId] : null

    return {
      user_id:           userId,
      email:             pe.email,
      full_name:         prof?.full_name ?? null,
      company_id:        pe.company_id,
      company_name:      (pe.companies as Record<string, unknown>)?.name ?? '',
      hours_used:        Math.round((usage?.hours ?? 0) * 10) / 10,
      reservation_count: usage?.count ?? 0,
    }
  })

  return NextResponse.json(result)
}
