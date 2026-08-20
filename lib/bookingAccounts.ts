import { createAdminClient } from '@/lib/supabase/server'

export type CreateBookingCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; status: number; error: string }

// Shared account-creation logic for the booking_customers system — used by
// both day-pass and /book, since they intentionally share one lightweight
// account system (see migration 044/045 notes). Kept in one place after a
// bug where day-pass's duplicate-email detection was fixed but would have
// silently stayed broken in a second, separately-hand-copied version.
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
