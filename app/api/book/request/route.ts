import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificDayBounds } from '@/lib/utils'

function pacificToUTC(dateStr: string, timeStr: string): Date {
  const { start: dayStart } = getPacificDayBounds(dateStr)
  const [h, m] = timeStr.split(':').map(Number)
  return new Date(dayStart.getTime() + h * 3600000 + m * 60000)
}

export async function POST(request: Request) {
  const admin = createAdminClient()
  const body  = await request.json()

  const { room_id, date, start, end, name, email, phone, company_name, notes } = body

  if (!room_id || !date || !start || !end || !name || !email || !phone) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const startTime = pacificToUTC(date, start)
  const endTime   = pacificToUTC(date, end)

  if (endTime <= startTime) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }

  // Confirm room exists and is externally bookable
  const { data: room } = await admin
    .from('rooms')
    .select('id, name')
    .eq('id', room_id)
    .eq('external_bookable', true)
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  // Check for conflicts
  const { data: conflicts } = await admin
    .from('reservations')
    .select('id')
    .eq('room_id', room_id)
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'This time slot was just booked. Please go back and select another time.' },
      { status: 409 }
    )
  }

  // Create a blocking reservation (slot held immediately)
  const { data: reservation, error: resError } = await admin
    .from('reservations')
    .insert({
      room_id,
      user_id:              null,   // no member user for external bookings
      company_id:           null,
      title:                `External Booking — ${name}`,
      notes:                null,
      start_time:           startTime.toISOString(),
      end_time:             endTime.toISOString(),
      is_external_booking:  true,
    })
    .select('id')
    .single()

  if (resError || !reservation) {
    return NextResponse.json({ error: 'Could not create reservation. Please try again.' }, { status: 500 })
  }

  // Create the external booking record
  const { data: booking, error: bookingError } = await admin
    .from('external_bookings')
    .insert({
      room_id,
      reservation_id:  reservation.id,
      external_name:   name.trim(),
      external_email:  email.trim().toLowerCase(),
      external_phone:  phone.trim(),
      company_name:    company_name?.trim() || null,
      notes:           notes?.trim() || null,
      start_time:      startTime.toISOString(),
      end_time:        endTime.toISOString(),
      status:          'pending',
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    // Roll back the reservation if external booking fails
    await admin.from('reservations').delete().eq('id', reservation.id)
    return NextResponse.json({ error: 'Could not save booking. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, booking_id: booking.id }, { status: 201 })
}
