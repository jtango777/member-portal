import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { createBookingCustomerAccount } from '@/lib/bookingAccounts'
import { verifyRecaptcha } from '@/lib/recaptcha'

// Same shared booking_customers account system as day-pass — see
// lib/bookingAccounts.ts. /book now requires an account at checkout too
// (matches the Industrious reference model, decided 2026-08-19).
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { first_name, last_name, email, password, recaptcha_token } = await request.json()

  if (!(await verifyRecaptcha(recaptcha_token))) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  const result = await createBookingCustomerAccount({ firstName: first_name ?? '', lastName: last_name ?? '', email: email ?? '', password: password ?? '' })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, customer_id: result.customerId })
}
