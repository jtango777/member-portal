import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

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
      .select('id, status')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (booking && booking.status !== 'confirmed') {
      await admin
        .from('external_bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking.id)
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
