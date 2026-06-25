import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calcHoursUsed, getPacificMonthBounds } from '@/lib/utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM
  const companyId = searchParams.get('companyId')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!month || !companyId) {
    return NextResponse.json({ error: 'Missing month or companyId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { start, end } = getPacificMonthBounds(month)

  const { data: monthRes } = await admin
    .from('reservations')
    .select('start_time, end_time')
    .eq('company_id', companyId)
    .gte('start_time', start)
    .lte('end_time', end)

  const hours = calcHoursUsed(monthRes ?? [])
  return NextResponse.json({ hours })
}
