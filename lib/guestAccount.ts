import { SupabaseClient } from '@supabase/supabase-js'

// The shared placeholder account used for reservations attributed to a
// pending member (invited/added but no real account yet) or a genuinely
// unmatched historical booking. Its profile is named "Guest" (not
// "Historical Booking" — that read as a confusing system label, especially
// for future-dated reservations). Bookings tagged this way carry
// historical_email so they auto-link to the real account the moment that
// person signs up (see /api/invites/accept and accept-by-email).
export const GUEST_ACCOUNT_EMAIL = 'legacy-bookings@bizhaus.internal'

// Looks up the Guest placeholder account, creating it if this is the very
// first booking ever attributed to a pending member (normally it already
// exists from the historical reservation import).
export async function getOrCreateGuestUserId(admin: SupabaseClient): Promise<string> {
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = users.find(u => u.email === GUEST_ACCOUNT_EMAIL)
  if (existing) return existing.id

  const { data: created, error } = await admin.auth.admin.createUser({
    email: GUEST_ACCOUNT_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (error || !created.user) throw new Error(error?.message ?? 'Failed to create Guest placeholder account')
  await admin.from('profiles').insert({ id: created.user.id, full_name: 'Guest', first_name: 'Guest', is_admin: false, is_active: false })
  return created.user.id
}
