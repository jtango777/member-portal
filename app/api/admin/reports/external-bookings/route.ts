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

  if (!month) return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })

  const { start, end } = getPacificMonthBounds(month)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('external_bookings')
    .select(`
      id, external_name, external_email, external_phone, company_name,
      start_time, end_time, status, stripe_payment_intent_id, created_at,
      rooms ( name, external_name, price_per_hour, location_id, locations ( name ) )
    `)
    .gte('start_time', start)
    .lt('start_time', end)
    .order('start_time')

  if (error) {
    console.error('[admin/reports] External bookings error:', error.message)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
