import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatDayAndMonth, formatTime } from '@/lib/utils'
import { isRoomBookingCancellable, ROOM_CANCEL_CUTOFF_LABEL } from '@/lib/roomCancel'
import { stripeForPayment, LEGACY_LOCATION_ID } from '@/lib/stripe'
import {
  sendRoomBookingCancellationEmail,
  sendRoomCancellationStaffNotification,
  sendSystemAlert,
} from '@/lib/email'

/**
 * A customer cancelling their own conference room booking.
 *
 * Rooms had no self-serve cancellation at all; the only way out was
 * ringing us. They now work the same way day passes do: cancel up to
 * 9 PM Pacific the night before (Caroline, 2026-11-20).
 *
 * What comes back is credit, never money. No Stripe refund is attempted
 * and the QuickBooks receipt is left alone, because the payment stands:
 * BizHaus is holding it against a future booking. The credit is not a
 * balance anywhere. Nothing is written to a credits table, nothing shows
 * on My Bookings, and it cannot be spent online. It exists as a sentence
 * in the email naming the amount and the confirmation number, and it is
 * redeemed by ringing us and quoting that number. That is deliberate:
 * staff decide what it is worth against the new booking.
 *
 * Staff are copied on every one of these, because a cancellation is the
 * moment somebody needs to know a room has come free.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { confirmation_number } = await request.json()
  if (!confirmation_number) {
    return NextResponse.json({ error: 'Missing confirmation number.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ownership checked here rather than by RLS: external_bookings has no
  // customer UPDATE policy, so the write below needs the service role.
  const { data: booking } = await admin
    .from('external_bookings')
    .select('id, confirmation_number, customer_id, status, start_time, end_time, reservation_id, stripe_payment_intent_id, external_name, external_email, rooms(location_id, name, external_name, locations(name))')
    .eq('confirmation_number', confirmation_number)
    .eq('customer_id', user.id)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'This booking has already been cancelled.' }, { status: 400 })
  }

  if (!isRoomBookingCancellable(booking.start_time)) {
    return NextResponse.json({
      error: `This booking can no longer be cancelled, the ${ROOM_CANCEL_CUTOFF_LABEL} cutoff has passed. Contact us at bookings@bizhaus.com.`,
    }, { status: 400 })
  }

  const room = booking.rooms as unknown as {
    location_id: string; name?: string; external_name?: string; locations?: { name: string }
  } | null

  // The amount is read from Stripe, not recalculated: it is the figure the
  // customer was actually charged, and it is what the credit is worth.
  let amountCents = 0
  if (booking.stripe_payment_intent_id) {
    try {
      const stripe = await stripeForPayment(room?.location_id ?? LEGACY_LOCATION_ID, booking.stripe_payment_intent_id)
      const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
      amountCents = pi.amount
    } catch (err) {
      // Not fatal: the cancellation should still happen and the room should
      // still free up. Staff get told the figure is missing.
      console.error('[book/cancel] Could not read the Stripe amount:', err)
      await sendSystemAlert('Room cancellation: could not read the paid amount from Stripe', {
        confirmation_number, booking_id: booking.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const { error: updateError } = await admin
    .from('external_bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', booking.id)

  if (updateError) {
    console.error('[book/cancel] Could not cancel:', updateError.message)
    return NextResponse.json({ error: 'Could not cancel this booking. Contact us at bookings@bizhaus.com.' }, { status: 500 })
  }

  // Put the room back on sale. Done after the status write, so a failure
  // here leaves a cancelled booking holding a slot rather than a live
  // booking with no slot.
  if (booking.reservation_id) {
    await admin.from('reservations').delete().eq('id', booking.reservation_id)
  }

  const start = new Date(booking.start_time)
  const amount = `$${(amountCents / 100).toFixed(2)}`
  // Pacific, explicitly. date-fns formats in the server's zone and Vercel
  // runs UTC, which has emailed customers the wrong time before.
  const when = `${formatDayAndMonth(start)} at ${formatTime(start)}`
  const roomName = room?.external_name ?? room?.name ?? 'your room'
  const locationName = room?.locations?.name ?? ''

  if (booking.external_email) {
    await sendRoomBookingCancellationEmail(booking.external_email, {
      guestName: booking.external_name ?? '',
      room: roomName,
      location: locationName,
      when,
      amount,
      credited: true,
      confirmationNumber: booking.confirmation_number ?? confirmation_number,
    })
  }

  await sendRoomCancellationStaffNotification({
    guestName: booking.external_name ?? '',
    guestEmail: booking.external_email ?? '',
    room: roomName,
    location: locationName,
    when,
    amount,
    confirmationNumber: booking.confirmation_number ?? confirmation_number,
  })

  return NextResponse.json({ ok: true, creditedCents: amountCents })
}
