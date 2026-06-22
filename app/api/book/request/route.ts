import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPacificDayBounds } from '@/lib/utils'
import { sendExternalBookingReceipt } from '@/lib/email'
import { createSalesReceipt } from '@/lib/quickbooks'
import { rateLimit } from '@/lib/rate-limit'
import Stripe from 'stripe'
import { format } from 'date-fns'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

function pacificToUTC(dateStr: string, timeStr: string): Date {
  const { start: dayStart } = getPacificDayBounds(dateStr)
  const [h, m] = timeStr.split(':').map(Number)
  return new Date(dayStart.getTime() + h * 3600000 + m * 60000)
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const body  = await request.json()

  const { room_id, date, start, end, name, email, phone, company_name, notes, stripe_payment_intent_id } = body

  if (!room_id || !date || !start || !end || !name || !email || !phone) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  if (!/^[\d\s()+\-\.]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })
  }

  const startTime = pacificToUTC(date, start)
  const endTime   = pacificToUTC(date, end)

  if (endTime <= startTime) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }

  // Confirm room exists and is externally bookable
  const { data: room } = await admin
    .from('rooms')
    .select('id, name, external_name, price_per_hour, location_id, location:locations(name)')
    .eq('id', room_id)
    .eq('external_bookable', true)
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  // Verify payment amount matches expected price
  if (stripe_payment_intent_id && room.price_per_hour) {
    const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id)
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
    const expectedCents = Math.round(hours * (room.price_per_hour as number) * 100)
    if (pi.amount < expectedCents) {
      return NextResponse.json({ error: 'Payment amount does not match the booking price.' }, { status: 400 })
    }
  }

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
      status:          'confirmed',
      stripe_payment_intent_id: stripe_payment_intent_id ?? null,
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
    let cardLast4: string | null = null
    let cardBrand: string | null = null
    let amountPaid = ''

    if (stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id)
      amountPaid = `$${(pi.amount / 100).toFixed(2)}`

      if (pi.latest_charge) {
        const charge = await stripe.charges.retrieve(pi.latest_charge as string)
        cardLast4 = charge.payment_method_details?.card?.last4 ?? null
        cardBrand = charge.payment_method_details?.card?.brand ?? null
      }
    }

    const padTime = (t: string) => t.includes(':') && t.indexOf(':') < 2 ? '0' + t : t
    const formattedDate = format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
    const startLabel = format(new Date(`2000-01-01T${padTime(start)}:00`), 'h:mm a')
    const endLabel = format(new Date(`2000-01-01T${padTime(end)}:00`), 'h:mm a')
    const loc = room.location as { name: string } | { name: string }[] | null
    const locationName = Array.isArray(loc) ? loc[0]?.name ?? '' : loc?.name ?? ''

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

  // Create QuickBooks sales receipt (non-blocking)
  try {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
    const totalAmount = hours * (room.price_per_hour as number)

    const padTime = (t: string) => t.includes(':') && t.indexOf(':') < 2 ? '0' + t : t
    const qbDate = format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
    const qbStart = format(new Date(`2000-01-01T${padTime(start)}:00`), 'h:mm a')
    const qbEnd = format(new Date(`2000-01-01T${padTime(end)}:00`), 'h:mm a')

    await createSalesReceipt(room.location_id as string, {
      guestName: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      roomName: (room.external_name ?? room.name) as string,
      date: qbDate,
      time: `${qbStart} – ${qbEnd}`,
      amount: totalAmount,
    })
  } catch (err) {
    console.error('[qb] Failed to create sales receipt:', err)
  }

  return NextResponse.json({ ok: true, booking_id: booking.id }, { status: 201 })
}
