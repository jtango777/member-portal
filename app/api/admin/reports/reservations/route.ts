import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificMonthBounds } from '@/lib/utils'
import { resolveHistoricalBookings } from '@/lib/resolveHistoricalBookings'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM

  if (!month) return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })

  const { start, end } = getPacificMonthBounds(month)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reservations')
    .select(`
      id, title, notes, start_time, end_time, historical_email,
      profiles ( full_name ),
      companies ( name ),
      rooms ( name, locations ( name ) )
    `)
    .gte('start_time', start)
    .lt('start_time', end)
    .order('start_time')

  if (error) {
    console.error('[admin/reports] Reservations error:', error.message)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }

  // Same as the admin Reservations page — a booking attributed to a known
  // (but not-yet-signed-up) member should show their company (or name),
  // not the generic Guest placeholder.
  const resolved = await resolveHistoricalBookings(admin, data ?? [])

  return NextResponse.json(resolved)
}
