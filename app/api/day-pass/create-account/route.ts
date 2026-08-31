import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { createBookingCustomerAccount } from '@/lib/bookingAccounts'
import { verifyRecaptcha } from '@/lib/recaptcha'

// Creates a day-pass customer account — deliberately NOT a member account.
// Same underlying Supabase Auth mechanics as the member invite flow (see
// app/api/invites/accept/route.ts), but writes to booking_customers
// instead of profiles, so this person never shows up as a member or gets
// member-portal access. Shared with /api/book/create-account — see
// lib/bookingAccounts.ts.
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
