import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendDayPassConfirmation } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import Stripe from 'stripe'
import { format } from 'date-fns'
import { DAY_PASS_PRICE_CENTS } from '@/app/api/day-pass/create-payment-intent/route'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const body = await request.json()

  const { customer_id, location_id, date, guest_name, email, stripe_payment_intent_id, recaptcha_token } = body

  if (!customer_id || !location_id || !date || !guest_name || !email || !stripe_payment_intent_id) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
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
  if (pi.amount < DAY_PASS_PRICE_CENTS) {
    return NextResponse.json({ error: 'Payment amount does not match the day pass price.' }, { status: 400 })
  }

  const { data: dayPass, error: insertError } = await admin
    .from('day_passes')
    .insert({
      customer_id,
      location_id,
      date,
      price_cents: DAY_PASS_PRICE_CENTS,
      status: 'confirmed',
      stripe_payment_intent_id,
    })
    .select('id')
    .single()

  if (insertError || !dayPass) {
    console.error('[day-pass/request] Insert error:', insertError?.message)
    return NextResponse.json({ error: 'Could not save reservation. Please try again.' }, { status: 500 })
  }

  const confirmationNumber = dayPass.id.slice(0, 8).toUpperCase()

  // Attach the confirmation number to the row for easy lookup later.
  await admin.from('day_passes').update({ confirmation_number: confirmationNumber }).eq('id', dayPass.id)

  // Send confirmation / receipt email (non-blocking — don't fail the reservation if email fails)
  try {
    let cardLast4: string | null = null
    let cardBrand: string | null = null

    if (pi.latest_charge) {
      const charge = await stripe.charges.retrieve(pi.latest_charge as string)
      cardLast4 = charge.payment_method_details?.card?.last4 ?? null
      cardBrand = charge.payment_method_details?.card?.brand ?? null
    }

    await sendDayPassConfirmation(email.trim().toLowerCase(), {
      confirmationNumber,
      location: location.name,
      date: format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy'),
      guestName: guest_name.trim(),
      amountPaid: `$${(pi.amount / 100).toFixed(2)}`,
      cardLast4,
      cardBrand,
      paymentDate: format(new Date(), 'MMMM d, yyyy'),
    })
  } catch (err) {
    console.error('[email] Failed to send day pass confirmation:', err)
  }

  return NextResponse.json({ ok: true, day_pass_id: dayPass.id, confirmation_number: confirmationNumber }, { status: 201 })
}
