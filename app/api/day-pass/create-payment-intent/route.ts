import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit } from '@/lib/rate-limit'
import { getDay } from 'date-fns'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

// Flat price across all locations for now — if that ever changes, this
// becomes a per-location lookup the same way /book looks up price_per_hour.
export const DAY_PASS_PRICE_CENTS = 3000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { location_id, dates } = await request.json()

  if (!location_id || !Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Never trust the client's date list — day passes are Monday–Friday
  // only, same rule the picker itself enforces client-side.
  const uniqueDates = [...new Set(dates)]
  const allWeekdays = uniqueDates.every((d: string) => {
    const day = getDay(new Date(d + 'T12:00:00'))
    return day !== 0 && day !== 6
  })
  if (!allWeekdays) {
    return NextResponse.json({ error: 'Day passes are only available Monday–Friday.' }, { status: 400 })
  }

  // Never trust the client's date list to be in the future either — the
  // page's default date used to be a hardcoded literal that silently
  // drifted into the past as real time moved on, and nothing on the
  // client actually blocked "Continue" from proceeding with a stale
  // past-date selection (caught 2026-08-31). This is the real guard;
  // the client-side calendar greying out past days is just UX on top.
  const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const noPastDates = uniqueDates.every((d: string) => d >= todayPacific)
  if (!noPastDates) {
    return NextResponse.json({ error: 'One or more selected dates is in the past.' }, { status: 400 })
  }

  const amount = DAY_PASS_PRICE_CENTS * uniqueDates.length
  const sortedDates = uniqueDates.sort()

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { type: 'day_pass', location_id, dates: sortedDates.join(',') },
    description: sortedDates.length > 1
      ? `BizHaus — Day Pass × ${sortedDates.length} (${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]})`
      : `BizHaus — Day Pass · ${sortedDates[0]}`,
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
