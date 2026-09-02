import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendDayPassConfirmation, sendDayPassStaffNotification, sendSystemAlert } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { createSalesReceipt } from '@/lib/quickbooks'
import Stripe from 'stripe'
import { format, getDay } from 'date-fns'
import { DAY_PASS_PRICE_CENTS } from '@/app/api/day-pass/create-payment-intent/route'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const body = await request.json()

  const { customer_id, location_id, dates, guest_name, email, stripe_payment_intent_id, recaptcha_token } = body

  if (!customer_id || !location_id || !Array.isArray(dates) || dates.length === 0 || !guest_name || !email || !stripe_payment_intent_id) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const uniqueDates = [...new Set(dates)] as string[]
  const allWeekdays = uniqueDates.every(d => { const day = getDay(new Date(d + 'T12:00:00')); return day !== 0 && day !== 6 })
  if (!allWeekdays) {
    return NextResponse.json({ error: 'Day passes are only available Monday–Friday.' }, { status: 400 })
  }

  // Same guard as /create-payment-intent — this route is the one that
  // actually writes the confirmed reservation, so it needs its own check
  // rather than trusting that payment-intent creation already caught it.
  const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const noPastDates = uniqueDates.every(d => d >= todayPacific)
  if (!noPastDates) {
    return NextResponse.json({ error: 'One or more selected dates is in the past.' }, { status: 400 })
  }

  if (!(await verifyRecaptcha(recaptcha_token))) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  // Confirm the customer account and location are real before trusting
  // anything else in the body.
  const { data: customer } = await admin
    .from('booking_customers')
    .select('id')
    .eq('id', customer_id)
    .single()
  if (!customer) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

  const { data: location } = await admin
    .from('locations')
    .select('id, name')
    .eq('id', location_id)
    .single()
  if (!location) return NextResponse.json({ error: 'Location not found.' }, { status: 404 })

  // Re-verify payment server-side — never trust the client's word that it
  // succeeded. Same pattern as /api/book/request.
  const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id)
  if (pi.status !== 'succeeded') {
    return NextResponse.json({ error: 'Payment has not been completed.' }, { status: 400 })
  }
  const expectedCents = DAY_PASS_PRICE_CENTS * uniqueDates.length
  if (pi.amount < expectedCents) {
    return NextResponse.json({ error: 'Payment amount does not match the day pass price.' }, { status: 400 })
  }

  // One reservation row per day (so admin/check-in/RLS all stay per-day),
  // sharing one confirmation number and one Stripe payment across the
  // whole purchase — generated up front since it's not tied to any single
  // row's id anymore.
  const confirmationNumber = crypto.randomUUID().slice(0, 8).toUpperCase()
  const sortedDates = [...uniqueDates].sort()

  const { data: dayPasses, error: insertError } = await admin
    .from('day_passes')
    .insert(sortedDates.map(date => ({
      customer_id,
      location_id,
      date,
      price_cents: DAY_PASS_PRICE_CENTS,
      status: 'confirmed' as const,
      stripe_payment_intent_id,
      confirmation_number: confirmationNumber,
    })))
    .select('id')

  if (insertError || !dayPasses || dayPasses.length !== sortedDates.length) {
    console.error('[day-pass/request] Insert error:', insertError?.message)
    // Roll back whatever did get created so a partial failure doesn't leave
    // a half-booked range behind.
    await admin.from('day_passes').delete().eq('stripe_payment_intent_id', stripe_payment_intent_id)
    return NextResponse.json({ error: 'Could not save reservation. Please try again.' }, { status: 500 })
  }

  // Create QuickBooks sales receipts right here, not in the Stripe webhook.
  // The webhook fires the instant Stripe confirms payment — often *before*
  // the insert above has actually landed, since this route and the webhook
  // run concurrently with no guaranteed ordering. Creating receipts here
  // instead means the row is guaranteed to already exist. The webhook keeps
  // a matching block as a backup, guarded to skip any row that already has
  // a qb_receipt_id, so nothing gets double-created if both paths run.
  for (const [i, date] of sortedDates.entries()) {
    try {
      const dateLabel = format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
      const receipt = await createSalesReceipt(location_id, {
        guestName: guest_name.trim(),
        email: email.trim().toLowerCase(),
        phone: '',
        roomName: 'Day Pass',
        date: dateLabel,
        time: '9:00am – 5:00pm',
        amount: DAY_PASS_PRICE_CENTS / 100,
      })
      if (receipt?.Id) {
        await admin.from('day_passes').update({ qb_receipt_id: receipt.Id }).eq('id', dayPasses[i].id)
      }
    } catch (err: any) {
      if (err?.message === 'QB_NEEDS_RECONNECT') {
        console.warn('[qb] Location needs reconnection — skipping day pass sales receipt')
        await sendSystemAlert('QuickBooks needs reconnecting', {
          location_id, confirmation_number: confirmationNumber, date,
        })
        break // same location for every row in the group — no point retrying each one
      } else {
        console.error('[qb] Failed to create day pass sales receipt:', err)
        await sendSystemAlert('Day pass QB receipt creation failed', {
          location_id, confirmation_number: confirmationNumber, date,
          error: err?.message ?? String(err),
        })
      }
    }
  }

  // Send confirmation / receipt email (non-blocking — don't fail the reservation if email fails)
  try {
    let cardLast4: string | null = null
    let cardBrand: string | null = null

    if (pi.latest_charge) {
      const charge = await stripe.charges.retrieve(pi.latest_charge as string)
      cardLast4 = charge.payment_method_details?.card?.last4 ?? null
      cardBrand = charge.payment_method_details?.card?.brand ?? null
    }

    const dateLabel = sortedDates.length > 1
      ? `${sortedDates.length} days: ${sortedDates.map(d => format(new Date(d + 'T12:00:00'), 'EEE, MMM d')).join(', ')}`
      : format(new Date(sortedDates[0] + 'T12:00:00'), 'EEEE, MMMM d, yyyy')

    await sendDayPassConfirmation(email.trim().toLowerCase(), {
      confirmationNumber,
      location: location.name,
      date: dateLabel,
      guestName: guest_name.trim(),
      amountPaid: `$${(pi.amount / 100).toFixed(2)}`,
      cardLast4,
      cardBrand,
      paymentDate: format(new Date(), 'MMMM d, yyyy'),
    })
  } catch (err) {
    console.error('[email] Failed to send day pass confirmation:', err)
  }

  // Staff notification — separate try/catch so a failure here never
  // affects the customer's own confirmation email above.
  try {
    const dateLabel = sortedDates.length > 1
      ? `${sortedDates.length} days: ${sortedDates.map(d => format(new Date(d + 'T12:00:00'), 'EEE, MMM d')).join(', ')}`
      : format(new Date(sortedDates[0] + 'T12:00:00'), 'EEEE, MMMM d, yyyy')

    await sendDayPassStaffNotification({
      confirmationNumber,
      guestName: guest_name.trim(),
      guestEmail: email.trim().toLowerCase(),
      location: location.name,
      date: dateLabel,
      amountPaid: `$${(pi.amount / 100).toFixed(2)}`,
    })
  } catch (err) {
    console.error('[email] Failed to send day pass staff notification:', err)
    await sendSystemAlert('Day pass staff notification email failed', {
      confirmation_number: confirmationNumber, error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({ ok: true, day_pass_ids: dayPasses.map(d => d.id), confirmation_number: confirmationNumber }, { status: 201 })
}
