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

  const start      = new Date(`${month}-01T00:00:00`)
  const end        = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const daysInMonth = (end.getTime() - start.getTime()) / 86400000
  const availableHoursPerRoom = daysInMonth * 15 // 7am–10pm = 15 hrs/day

  const admin = createAdminClient()
  const [{ data: rooms }, { data: reservations }] = await Promise.all([
    admin.from('rooms').select('id, name, capacity, sort_order, locations ( name )').order('sort_order'),
    admin.from('reservations')
      .select('room_id, start_time, end_time')
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString()),
  ])

  const result = (rooms ?? []).map(r => {
    const roomRes = (reservations ?? []).filter(res => res.room_id === r.id)
    const hours_booked = roomRes.reduce((acc, res) => {
      return acc + (new Date(res.end_time).getTime() - new Date(res.start_time).getTime()) / 3600000
    }, 0)
    const utilization_pct = Math.round((hours_booked / availableHoursPerRoom) * 1000) / 10

    return {
      location:          (r.locations as any)?.name ?? '',
      room:              r.name,
      capacity:          r.capacity,
      bookings:          roomRes.length,
      hours_booked:      Math.round(hours_booked * 10) / 10,
      available_hours:   Math.round(availableHoursPerRoom * 10) / 10,
      utilization_pct,
    }
  })

  return NextResponse.json(result)
}
