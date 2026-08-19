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

    const { data: dayPass } = await admin
      .from('day_passes')
      .select('id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (dayPass) {
      await admin.from('day_passes').update({ status: 'declined' }).eq('id', dayPass.id)
    }
  }

  return NextResponse.json({ received: true })
}
