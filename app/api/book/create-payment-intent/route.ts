import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function POST(request: Request) {
  const { room_id, date, start, end } = await request.json()

  if (!room_id || !date || !start || !end) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Fetch room to get price
  const admin = createAdminClient()
  const { data: room } = await admin
    .from('rooms')
    .select('external_name, price_per_hour')
    .eq('id', room_id)
    .eq('external_bookable', true)
    .single()

  if (!room || !room.price_per_hour) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  // Calculate total
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
  const totalCents = Math.round(hours * room.price_per_hour * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount:   totalCents,
    currency: 'usd',
    metadata: { room_id, date, start, end },
    description: `BizHaus — ${room.external_name} · ${date} ${start}–${end}`,
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
