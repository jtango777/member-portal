import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit } from '@/lib/rate-limit'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

// Flat price across all locations for now — if that ever changes, this
// becomes a per-location lookup the same way /book looks up price_per_hour.
export const DAY_PASS_PRICE_CENTS = 3000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { location_id, date } = await request.json()

  if (!location_id || !date) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: DAY_PASS_PRICE_CENTS,
    currency: 'usd',
    metadata: { type: 'day_pass', location_id, date },
    description: `BizHaus — Day Pass · ${date}`,
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
