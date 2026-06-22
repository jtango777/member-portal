import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificDayBounds } from '@/lib/utils'
import { sendExternalBookingReceipt } from '@/lib/email'
import Stripe from 'stripe'
import { format } from 'date-fns'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

function pacificToUTC(dateStr: string, timeStr: string): Date {
  const { start: dayStart } = getPacificDayBounds(dateStr)
  const [h, m] = timeStr.split(':').map(Number)
  return new Date(dayStart.getTime() + h * 3600000 + m * 60000)
}

export async function POST(request: Request) {
  const admin = createAdminClient()
  const body  = await request.json()

  const { room_id, date, start, end, name, email, phone, company_name, notes, stripe_payment_intent_id } = body

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
    .select('id, name, external_name, location:locations(name)')
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

  // Send confirmation / receipt email (non-blocking — don't fail the booking if email fails)
  try {
    console.log('[email] Starting receipt email flow', { stripe_payment_intent_id, email, booking_id: booking.id })

    let cardLast4: string | null = null
    let cardBrand: string | null = null
    let amountPaid = ''

    if (stripe_payment_intent_id) {
      console.log('[email] Retrieving payment intent')
      const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id)
      amountPaid = `$${(pi.amount / 100).toFixed(2)}`
      console.log('[email] Got amount:', amountPaid, 'latest_charge:', pi.latest_charge)

      if (pi.latest_charge) {
        const charge = await stripe.charges.retrieve(pi.latest_charge as string)
        cardLast4 = charge.payment_method_details?.card?.last4 ?? null
        cardBrand = charge.payment_method_details?.card?.brand ?? null
        console.log('[email] Got card:', cardBrand, cardLast4)
      }
    } else {
      console.log('[email] No stripe_payment_intent_id in request body')
    }

    console.log('[email] Raw values — date:', date, 'start:', start, 'end:', end)
    const dateObj = new Date(date + 'T12:00:00')
    const startObj = new Date(`2000-01-01T${start}:00`)
    const endObj = new Date(`2000-01-01T${end}:00`)
    console.log('[email] Parsed dates:', dateObj, startObj, endObj)
    const formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy')
    const startLabel = format(startObj, 'h:mm a')
    const endLabel = format(endObj, 'h:mm a')
    const loc = room.location as { name: string } | { name: string }[] | null
    const locationName = Array.isArray(loc) ? loc[0]?.name ?? '' : loc?.name ?? ''

    console.log('[email] Sending receipt to', email.trim().toLowerCase())
    await sendExternalBookingReceipt(email.trim().toLowerCase(), {
      confirmationNumber: booking.id.slice(0, 8).toUpperCase(),
      room: (room.external_name ?? room.name) as string,
      location: locationName,
      date: formattedDate,
      time: `${startLabel} – ${endLabel}`,
      guestName: name.trim(),
      amountPaid,
      cardLast4,
      cardBrand,
      paymentDate: format(new Date(), 'MMMM d, yyyy'),
    })
    console.log('[email] Receipt sent successfully')
  } catch (err) {
    console.error('[email] Failed to send external booking receipt:', err)
  }

  return NextResponse.json({ ok: true, booking_id: booking.id }, { status: 201 })
}
