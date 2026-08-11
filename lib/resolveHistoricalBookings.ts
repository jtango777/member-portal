import { SupabaseClient } from '@supabase/supabase-js'

// A reservation tagged with historical_email belongs to a pending member
// (invited/added but no real account yet) rather than the generic "Guest"
// placeholder. Rather than showing their raw email, look up who they
// actually are and show their company (most useful at a glance) or their
// name — never the system-y "(pending)" wording.
export async function resolveHistoricalBookings<T extends { historical_email?: string | null; profiles?: any }>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<T[]> {
  const emails = [...new Set(rows.map(r => r.historical_email).filter((e): e is string => !!e).map(e => e.toLowerCase()))]
  if (emails.length === 0) return rows

  const { data: pending } = await supabase
    .from('permitted_emails')
    .select('email, full_name, companies(name)')
    .in('email', emails)

  const byEmail = new Map((pending ?? []).map(p => [p.email.toLowerCase(), p]))

  return rows.map(r => {
    if (!r.historical_email) return r
    const match = byEmail.get(r.historical_email.toLowerCase())
    const companyName = Array.isArray(match?.companies) ? match?.companies[0]?.name : (match?.companies as { name: string } | null | undefined)?.name
    const displayName = companyName || match?.full_name || r.historical_email
    return { ...r, profiles: { ...r.profiles, full_name: displayName } }
  })
}
