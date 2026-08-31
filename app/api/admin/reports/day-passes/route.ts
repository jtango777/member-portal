import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })

  // day_passes.date is a plain DATE column (no time/timezone component,
  // it's just the calendar day the pass is for) — a simple string range
  // is correct here, unlike the timestamptz columns the other reports
  // filter with getPacificMonthBounds.
  const [year, monthNum] = month.split('-').map(Number)
  const start = `${month}-01`
  const nextYear  = monthNum === 12 ? year + 1 : year
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('day_passes')
    .select(`
      id, date, price_cents, status, confirmation_number, created_at,
      day_pass_customers ( first_name, last_name, email ),
      locations ( name )
    `)
    .gte('date', start)
    .lt('date', end)
    .order('date')

  if (error) {
    console.error('[admin/reports] Day passes error:', error.message)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
