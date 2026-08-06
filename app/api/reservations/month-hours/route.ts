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
