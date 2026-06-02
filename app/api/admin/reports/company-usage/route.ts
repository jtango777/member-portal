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
  if (!month) return NextResponse.json({ error: 'month param required' }, { status: 400 })

  const start = new Date(`${month}-01T00:00:00`)
  const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1)

  const admin = createAdminClient()
  const [{ data: companies }, { data: reservations }] = await Promise.all([
    admin.from('companies').select('id, name, monthly_hours_allotment').order('name'),
    admin.from('reservations')
      .select('company_id, start_time, end_time')
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString()),
  ])

  const result = (companies ?? []).map(c => {
    const companyRes = (reservations ?? []).filter(r => r.company_id === c.id)
    const hours_used = companyRes.reduce((acc, r) => {
      return acc + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000
    }, 0)
    return {
      company_name:        c.name,
      monthly_allotment:   c.monthly_hours_allotment,
      hours_used:          Math.round(hours_used * 10) / 10,
      hours_remaining:     c.monthly_hours_allotment === 9999
                             ? 'Unlimited'
                             : Math.max(0, Math.round((c.monthly_hours_allotment - hours_used) * 10) / 10),
      reservation_count:   companyRes.length,
    }
  })

  return NextResponse.json(result)
}
