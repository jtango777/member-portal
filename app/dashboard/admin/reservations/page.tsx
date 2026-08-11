import { createClient } from '@/lib/supabase/server'
import AllBookingsView from '@/components/admin/AllBookingsView'
import { resolveHistoricalBookings } from '@/lib/resolveHistoricalBookings'

export const dynamic = 'force-dynamic'

export default async function AdminReservationsPage() {
  const supabase = await createClient()

  const [{ data: reservations }, { data: externalBookings }] = await Promise.all([
    supabase
      .from('reservations')
      .select('*, profiles(id, full_name), companies(id, name), rooms(id, name, location_id, locations(name))')
      .order('start_time', { ascending: true }),
    supabase
      .from('external_bookings')
      .select('*, rooms(name, external_name, price_per_hour, locations(name))')
      .order('created_at', { ascending: false }),
  ])

  // Historical bookings we can attribute to a known (but not-yet-signed-up)
  // member show their company (or name) instead of the generic placeholder.
  const resolvedReservations = await resolveHistoricalBookings(supabase, reservations ?? [])

  return (
    <AllBookingsView
      reservations={resolvedReservations}
      externalBookings={(externalBookings ?? []) as any}
    />
  )
}
