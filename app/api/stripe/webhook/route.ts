import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { createSalesReceipt } from '@/lib/quickbooks'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()
  console.log('[webhook] Event received:', event.type)

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: booking } = await admin
      .from('external_bookings')
      .select('id, status, room_id, external_name, external_email, external_phone, start_time, end_time')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (booking && booking.status !== 'confirmed') {
      await admin
        .from('external_bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking.id)
    }

    // Create QuickBooks sales receipt
    if (booking) {
      try {
        const { data: room } = await admin
          .from('rooms')
          .select('name, external_name, price_per_hour, location_id')
          .eq('id', booking.room_id)
          .single()

        if (room) {
          const totalAmount = pi.amount_received / 100

          const startDt = new Date(booking.start_time)
          const endDt = new Date(booking.end_time)
          // Format times in Pacific (BizHaus locations are all in CA)
          const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }
          const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }
          const startLabel = startDt.toLocaleTimeString('en-US', timeOpts)
          const endLabel = endDt.toLocaleTimeString('en-US', timeOpts)
          const dateLabel = startDt.toLocaleDateString('en-US', dateOpts)

          console.log('[qb] Creating sales receipt — location:', room.location_id, 'amount:', totalAmount)

          await createSalesReceipt(room.location_id, {
            guestName: booking.external_name,
            email: booking.external_email,
            phone: booking.external_phone,
            roomName: room.external_name ?? room.name,
            date: dateLabel,
            time: `${startLabel} – ${endLabel}`,
            amount: totalAmount,
          })
          console.log('[qb] Sales receipt created successfully')
        }
      } catch (err: any) {
        if (err?.message === 'QB_NEEDS_RECONNECT') {
          console.warn('[qb] Location needs reconnection — skipping sales receipt')
        } else {
          console.error('[qb] Failed to create sales receipt:', err)
        }
      }
    }

    // Day passes are inserted already-confirmed by /api/day-pass/request
    // (it re-verifies payment before writing the row), so there's no status
    // flip to do here — just the QuickBooks sales receipt. A multi-day
    // purchase shares one payment intent across several rows (one per
    // day), so this is a list now, not a single row.
    const { data: dayPasses } = await admin
      .from('day_passes')
      .select('id, customer_id, location_id, date, price_cents')
      .eq('stripe_payment_intent_id', pi.id)

    if (dayPasses && dayPasses.length > 0) {
      const { data: customer } = await admin
        .from('booking_customers')
        .select('first_name, last_name, email')
        .eq('id', dayPasses[0].customer_id)
        .single()

      if (customer) {
        // One QuickBooks line item per day, same per-instance pattern the
        // rest of this webhook uses — a range just means more calls here.
        for (const dayPass of dayPasses) {
          try {
            const dateLabel = new Date(dayPass.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
            })
            const amount = dayPass.price_cents / 100

            console.log('[qb] Creating day pass sales receipt — location:', dayPass.location_id, 'date:', dayPass.date, 'amount:', amount)

            await createSalesReceipt(dayPass.location_id, {
              guestName: `${customer.first_name} ${customer.last_name}`,
              email: customer.email,
              phone: '',
              roomName: 'Day Pass',
              date: dateLabel,
              time: '9:00am – 5:00pm',
              amount,
            })
            console.log('[qb] Day pass sales receipt created successfully')
          } catch (err: any) {
            if (err?.message === 'QB_NEEDS_RECONNECT') {
              console.warn('[qb] Location needs reconnection — skipping day pass sales receipt')
              break // same location for every row in the group — no point retrying each one
            } else {
              console.error('[qb] Failed to create day pass sales receipt:', err)
            }
          }
        }
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: booking } = await admin
      .from('external_bookings')
      .select('id, reservation_id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (booking) {
      await admin
        .from('external_bookings')
        .update({ status: 'declined' })
        .eq('id', booking.id)

      if (booking.reservation_id) {
        await admin
          .from('reservations')
          .delete()
          .eq('id', booking.reservation_id)
      }
    }

    // A multi-day purchase shares one payment intent across several rows —
    // decline all of them, not just one.
    await admin.from('day_passes').update({ status: 'declined' }).eq('stripe_payment_intent_id', pi.id)
  }

  return NextResponse.json({ received: true })
}
