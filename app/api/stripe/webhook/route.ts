import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { createSalesReceipt } from '@/lib/quickbooks'
import { format } from 'date-fns'

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
          const startDt = new Date(booking.start_time)
          const endDt = new Date(booking.end_time)
          const hours = (endDt.getTime() - startDt.getTime()) / 3_600_000
          const totalAmount = hours * (room.price_per_hour ?? 0)

          const padTime = (t: string) => t.includes(':') && t.indexOf(':') < 2 ? '0' + t : t
          const startStr = padTime(`${startDt.getUTCHours()}:${String(startDt.getUTCMinutes()).padStart(2, '0')}`)
          const endStr = padTime(`${endDt.getUTCHours()}:${String(endDt.getUTCMinutes()).padStart(2, '0')}`)

          console.log('[qb] Creating sales receipt — location:', room.location_id, 'amount:', totalAmount)

          await createSalesReceipt(room.location_id, {
            guestName: booking.external_name,
            email: booking.external_email,
            phone: booking.external_phone,
            roomName: room.external_name ?? room.name,
            date: format(startDt, 'EEEE, MMMM d, yyyy'),
            time: `${format(new Date(`2000-01-01T${startStr}:00`), 'h:mm a')} – ${format(new Date(`2000-01-01T${endStr}:00`), 'h:mm a')}`,
            amount: totalAmount,
          })
          console.log('[qb] Sales receipt created successfully')
        }
      } catch (err) {
        console.error('[qb] Failed to create sales receipt:', err)
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
  }

  return NextResponse.json({ received: true })
}
