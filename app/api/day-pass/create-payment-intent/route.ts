import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit } from '@/lib/rate-limit'
import { getDay, format } from 'date-fns'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DAY_PASS_PRICE_CENTS, MAX_DAY_PASS_DAYS, MAX_DAYS_MESSAGE } from '@/lib/dayPass'
import { closureName } from '@/lib/holidays'

// Re-exported so existing imports of these from this route keep working.
export { DAY_PASS_PRICE_CENTS, MAX_DAY_PASS_DAYS, MAX_DAYS_MESSAGE }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

// Flat price across all locations for now — if that ever changes, this
// becomes a per-location lookup the same way /book looks up price_per_hour.

// Days this customer already holds, so the same date can't be bought (and
// paid for) twice. Returns [] for a not-yet-created account.
export async function alreadyBookedDates(dates: string[]): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await createAdminClient()
    .from('day_passes')
    .select('date')
    .eq('customer_id', user.id)
    .eq('status', 'confirmed')
    .in('date', dates)
  return (data ?? []).map(r => r.date)
}

export function alreadyBookedMessage(dates: string[]): string {
  const labels = dates.map(d => format(new Date(d + 'T12:00:00'), 'EEE, MMM d')).join(', ')
  return `You already have a day pass for ${labels}. Pick different days, or check My Bookings.`
}

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

  // BizHaus is shut on these — the picker greys them out, this is the guard.
  const closedDay = (uniqueDates as string[]).find(d => closureName(d))
  if (closedDay) {
    return NextResponse.json({ error: `We're closed on ${closureName(closedDay)}. Please pick another day.` }, { status: 400 })
  }

  if (uniqueDates.length > MAX_DAY_PASS_DAYS) {
    return NextResponse.json({ error: MAX_DAYS_MESSAGE }, { status: 400 })
  }

  const clashes = await alreadyBookedDates(uniqueDates as string[])
  if (clashes.length > 0) {
    return NextResponse.json({ error: alreadyBookedMessage(clashes) }, { status: 409 })
  }

  const amount = DAY_PASS_PRICE_CENTS * uniqueDates.length
  const sortedDates = uniqueDates.sort()

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    // Cards only (Apple/Google Pay still work). Stripe's default also offered
    // Link's "save my info" box and bank payments, which take days to clear
    // while checkout expects an instant 'succeeded' (2026-09-15).
    payment_method_types: ['card'],
    metadata: { type: 'day_pass', location_id, dates: sortedDates.join(',') },
    description: sortedDates.length > 1
      ? `BizHaus — Day Pass × ${sortedDates.length} (${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]})`
      : `BizHaus — Day Pass · ${sortedDates[0]}`,
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
