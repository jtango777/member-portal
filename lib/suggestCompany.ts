import { SupabaseClient } from '@supabase/supabase-js'

// Looks at someone's own booking history (either tagged via historical_email
// for a pre-signup booking, or linked directly via user_id for a booking
// made after they already had an account) to infer their company when
// nothing else has one on file. Used both by the admin Edit Member
// suggestion and at signup time, so a brand-new registrant with existing
// getaroom booking history doesn't land with no company just because no
// admin had gotten to them yet.
export async function suggestCompanyForEmail(
  admin: SupabaseClient,
  email: string,
  userId?: string | null
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim()

  let query = admin
    .from('reservations')
    .select('company_id, companies(name)')
    .not('company_id', 'is', null)

  query = userId
    ? query.or(`historical_email.ilike.${normalizedEmail},user_id.eq.${userId}`)
    : query.ilike('historical_email', normalizedEmail)

  const { data } = await query

  const counts = new Map<string, number>()
  for (const r of data ?? []) {
    const companyName = (r.companies as any)?.name ?? ''
    if (companyName === 'External Booking (Legacy)') continue // not a real company
    counts.set(r.company_id as string, (counts.get(r.company_id as string) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}
