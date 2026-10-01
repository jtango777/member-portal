import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificDayBounds } from '@/lib/utils'
import { OPEN_MINUTES, CLOSE_MINUTES, lastBookableDate, pacificToday } from '@/lib/bookingRules'

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

// Which Pacific calendar day a moment falls on.
function toPacificDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: PT })
}

// Every day in the booking window where the room has no free half hour at
// all, so the date picker can grey it out. Without this you pick a date,
// open the time dropdown and find all sixteen slots say "Unavailable",
// which is a rotten way to discover a day is gone (Caroline, 2026-10-01).
async function fullyBookedDays(roomId: string) {
  const admin = createAdminClient()
  const from = getPacificDayBounds(pacificToday()).start
  const to   = getPacificDayBounds(lastBookableDate()).end
  const SLOTS_PER_DAY = (CLOSE_MINUTES - OPEN_MINUTES) / 30

  const [{ data: internal }, { data: external }] = await Promise.all([
    admin.from('reservations').select('start_time, end_time')
      .eq('room_id', roomId).lt('start_time', to.toISOString()).gt('end_time', from.toISOString()),
    admin.from('external_bookings').select('start_time, end_time')
      .eq('room_id', roomId).in('status', ['pending', 'confirmed'])
      .lt('start_time', to.toISOString()).gt('end_time', from.toISOString()),
  ])

  // Count the distinct bookable slots taken on each day. A booking that runs
  // outside opening hours still only blocks the slots inside them.
  const taken = new Map<string, Set<string>>()
  for (const res of [...(internal ?? []), ...(external ?? [])]) {
    let cur = new Date(res.start_time)
    const resEnd = new Date(res.end_time)
    while (cur < resEnd) {
      const slot = toSlotValue(cur)
      const [h, m] = slot.split(':').map(Number)
      const minutes = h * 60 + m
      if (minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES) {
        const day = toPacificDate(cur)
        if (!taken.has(day)) taken.set(day, new Set())
        taken.get(day)!.add(slot)
      }
      cur = new Date(cur.getTime() + 30 * 60 * 1000)
    }
  }

  return [...taken.entries()].filter(([, slots]) => slots.size >= SLOTS_PER_DAY).map(([day]) => day)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')
  const date   = searchParams.get('date') // YYYY-MM-DD

  if (roomId && searchParams.get('fullDays')) {
    return NextResponse.json({ fullDays: await fullyBookedDays(roomId) })
  }

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

  if (err1 || err2) {
    console.error('[book/availability] error:', err1?.message ?? err2?.message)
    return NextResponse.json({ error: 'Failed to check availability.' }, { status: 500 })
  }

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
