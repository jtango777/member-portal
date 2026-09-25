import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { roomBookingError } from '@/lib/bookingRules'
import { getClosureMap } from '@/lib/settings'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { room_id, date, start, end } = await request.json()

  if (!room_id || !date || !start || !end) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Weekends, closure days, past dates/times, the 9-5 window, half-hour
  // increments and the 6-month limit — checked here so no money is ever
  // taken for a booking the request route is going to reject.
  const ruleProblem = roomBookingError(date, start, end, await getClosureMap('rooms'))
  if (ruleProblem) return NextResponse.json({ error: ruleProblem }, { status: 400 })

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
    // Cards only (Apple/Google Pay still work). Stripe's default also offered
    // Link's "save my info" box and bank payments, which take days to clear
    // while checkout expects an instant 'succeeded' (2026-09-15).
    payment_method_types: ['card'],
    metadata: { room_id, date, start, end },
    description: `BizHaus — ${room.external_name} · ${date} ${start}–${end}`,
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
