import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Member list for admin "book on behalf of" pickers. Includes both
// already-registered members (real accounts) and pending members (invited
// or added but not yet signed up) — an admin needs to be able to attribute
// a booking to someone before they've created their account, same as the
// historical-reservation importer does.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const [{ data: profiles, error: profilesErr }, { data: pending, error: pendingErr }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, company_id, is_active, companies(name)')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('permitted_emails')
      .select('email, full_name, company_id, is_active, accepted_at, companies(name)')
      .is('accepted_at', null)
      .eq('is_active', true)
      .order('full_name'),
  ])

  if (profilesErr || pendingErr) return NextResponse.json({ error: 'Failed to load members.' }, { status: 500 })

  const registered = (profiles ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    company_id: p.company_id,
    company_name: (p.companies as unknown as { name: string } | null)?.name ?? '',
    pending: false as const,
  }))

  // Synthetic id (`pending:<email>`) — there's no real account/UUID yet, so
  // the owner picker and submit logic use this to know to tag the booking
  // with historical_email instead of a real user_id.
  const pendingMembers = (pending ?? [])
    .filter(p => (p.full_name ?? '').trim())
    .map(p => ({
      id: `pending:${p.email}`,
      full_name: `${p.full_name} (pending)`,
      company_id: p.company_id,
      company_name: (p.companies as unknown as { name: string } | null)?.name ?? '',
      pending: true as const,
      email: p.email,
    }))

  return NextResponse.json([...registered, ...pendingMembers])
}
