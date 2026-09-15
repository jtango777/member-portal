import { createAdminClient } from '@/lib/supabase/server'

export type CreateBookingCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; status: number; error: string }

// Shared account-creation logic for the booking_customers system — used by
// both day-pass and /book, since they intentionally share one lightweight
// account system (see migration 044/045 notes). Kept in one place after a
// bug where day-pass's duplicate-email detection was fixed but would have
// silently stayed broken in a second, separately-hand-copied version.
export type BookingCustomer = { id: string; first_name: string; last_name: string; email: string }

// Someone who already has a BizHaus login (staff or a portal member) can't
// sign up for a booking account — the email is taken — and logging in used
// to dead-end because no booking_customers row existed (found 2026-09-02,
// fixed 2026-09-15). This returns their booking account, building it from
// their existing login + portal name. With create=false it only looks
// (so merely visiting /day-pass doesn't add anyone to Booking Accounts);
// create=true is used when they log in there or actually check out.
export async function getOrLinkBookingCustomer(userId: string, create: boolean): Promise<BookingCustomer | null> {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('booking_customers')
    .select('id, first_name, last_name, email')
    .eq('id', userId)
    .maybeSingle()
  if (existing) return existing

  const { data: authData } = await admin.auth.admin.getUserById(userId)
  const email = authData?.user?.email?.toLowerCase()
  if (!email) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, full_name')
    .eq('id', userId)
    .maybeSingle()
  const [fullFirst, ...fullRest] = (profile?.full_name ?? '').trim().split(/\s+/)
  const first_name = profile?.first_name?.trim() || fullFirst || email.split('@')[0]
  const last_name  = profile?.last_name?.trim() || fullRest.join(' ')

  const customer = { id: userId, first_name, last_name, email }
  if (!create) return customer

  const { error } = await admin.from('booking_customers').upsert(customer, { onConflict: 'id', ignoreDuplicates: true })
  if (error) {
    console.error('[bookingAccounts] Link existing login error:', error.message)
    return null
  }
  return customer
}

export async function createBookingCustomerAccount({
  firstName, lastName, email, password,
}: {
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<CreateBookingCustomerResult> {
  if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
    return { ok: false, status: 400, error: 'Missing required fields.' }
  }
  if (password.length < 8) {
    return { ok: false, status: 400, error: 'Password must be at least 8 characters.' }
  }

  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  })

  if (authError) {
    // Match on the stable error code, not the message text — Supabase's
    // actual wording ("...has already been registered") doesn't contain
    // the substring "already registered".
    if (authError.code === 'email_exists' || authError.message.includes('already registered')) {
      return { ok: false, status: 409, error: 'An account with this email already exists. Please log in instead.' }
    }
    console.error('[bookingAccounts] Auth create error:', authError.message)
    return { ok: false, status: 500, error: 'Failed to create account.' }
  }

  const { error: dbError } = await admin.from('booking_customers').insert({
    id: authData.user.id,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    email: normalizedEmail,
  })

  if (dbError) {
    console.error('[bookingAccounts] DB insert error:', dbError.message)
    // Roll back the auth user so a failed signup doesn't leave an orphaned account.
    await admin.auth.admin.deleteUser(authData.user.id)
    return { ok: false, status: 500, error: 'Failed to create account.' }
  }

  return { ok: true, customerId: authData.user.id }
}
