import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificDayBounds } from '@/lib/utils'

const PT = 'America/Los_Angeles'

// Convert a UTC Date to a Pacific-time slot string like "9:00" or "14:30"
function toSlotValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PT,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(date)
  const h = parseInt(parts.find(p => p.type === 'hour')!.value)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  return `${h}:${(m < 30 ? 0 : 30).toString().padStart(2, '0')}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')
  const date   = searchParams.get('date') // YYYY-MM-DD

  if (!roomId || !date) {
    return NextResponse.json({ error: 'Missing roomId or date' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { start, end } = getPacificDayBounds(date)

  const [{ data: internal, error: err1 }, { data: external, error: err2 }] = await Promise.all([
    admin
      .from('reservations')
      .select('start_time, end_time')
      .eq('room_id', roomId)
      .lt('start_time', end.toISOString())
      .gt('end_time', start.toISOString()),
    admin
      .from('external_bookings')
      .select('start_time, end_time')
      .eq('room_id', roomId)
      .in('status', ['pending', 'confirmed'])
      .lt('start_time', end.toISOString())
      .gt('end_time', start.toISOString()),
  ])

  if (err1 || err2) return NextResponse.json({ error: err1?.message ?? err2?.message }, { status: 500 })

  const allBookings = [...(internal ?? []), ...(external ?? [])]

  // Walk each booking in 30-min steps and collect blocked slot values
  // Returns only time strings — no names or member data exposed
  const blocked = new Set<string>()
  for (const res of allBookings) {
    let cur = new Date(res.start_time)
    const resEnd = new Date(res.end_time)
    while (cur < resEnd) {
      blocked.add(toSlotValue(cur))
      cur = new Date(cur.getTime() + 30 * 60 * 1000)
    }
  }

  return NextResponse.json({ blockedSlots: Array.from(blocked) })
}
