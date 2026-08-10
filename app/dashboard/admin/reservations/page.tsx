import { createClient } from '@/lib/supabase/server'
import AllBookingsView from '@/components/admin/AllBookingsView'

export const dynamic = 'force-dynamic'

export default async function AdminReservationsPage() {
  const supabase = await createClient()

  const [{ data: reservations }, { data: externalBookings }, { data: permitted }] = await Promise.all([
    supabase
      .from('reservations')
      .select('*, profiles(id, full_name), companies(id, name), rooms(id, name, location_id, locations(name))')
      .order('start_time', { ascending: true }),
    supabase
      .from('external_bookings')
      .select('*, rooms(name, external_name, price_per_hour, locations(name))')
      .order('created_at', { ascending: false }),
    supabase.from('permitted_emails').select('email, full_name'),
  ])

  // Historical bookings we can attribute to a known (but not-yet-signed-up)
  // member show their real name instead of the generic placeholder — only
  // genuinely unmatched bookings keep the placeholder's name.
  const nameByEmail = new Map(
    (permitted ?? [])
      .filter(p => p.full_name)
      .map(p => [p.email.toLowerCase(), p.full_name as string])
  )
  const resolvedReservations = (reservations ?? []).map(r => {
    const knownName = r.historical_email ? nameByEmail.get(r.historical_email.toLowerCase()) : null
    return knownName
      ? { ...r, profiles: { ...r.profiles, full_name: `${knownName} (pending)` } }
      : r
  })

  return (
    <AllBookingsView
      reservations={resolvedReservations}
      externalBookings={(externalBookings ?? []) as any}
    />
  )
}
