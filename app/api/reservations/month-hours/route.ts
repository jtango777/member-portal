import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calcHoursUsed, getPacificMonthBounds } from '@/lib/utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM
  const scope = searchParams.get('scope') ?? 'company' // 'company' or 'individual'
  // `id` is the current param name; `companyId` kept for back-compat with
  // any stale cached clients still calling the old shape.
  const id = searchParams.get('id') ?? searchParams.get('companyId')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!month || !id) {
    return NextResponse.json({ error: 'Missing month or id' }, { status: 400 })
  }

  // `id` came straight from a query param with no check that it was
  // actually the caller's own — the only real caller (CalendarView) only
  // ever passes the caller's own company or individual id, but nothing
  // enforced that server-side, so any logged-in member could pass any
  // other user's or company's id here and read their monthly hours used.
  // Caught 2026-09-11, same audit as the room-access bug.
  const { data: profile } = await supabase.from('profiles').select('is_admin, company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  const isOwnId = scope === 'individual' ? id === user.id : id === profile.company_id
  if (!profile.is_admin && !isOwnId) {
    return NextResponse.json({ error: 'You can only view your own hours.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { start, end } = getPacificMonthBounds(month)

  // Company scope pools hours across everyone in the company; individual
  // scope (no company) only counts this one person's own bookings.
  let query = admin
    .from('reservations')
    .select('start_time, end_time')
    .gte('start_time', start)
    .lt('start_time', end)
  query = scope === 'individual' ? query.eq('user_id', id) : query.eq('company_id', id)

  const { data: monthRes } = await query

  const hours = calcHoursUsed(monthRes ?? [])
  return NextResponse.json({ hours })
}
