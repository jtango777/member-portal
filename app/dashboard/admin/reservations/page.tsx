import { createClient } from '@/lib/supabase/server'
import AllBookingsView from '@/components/admin/AllBookingsView'

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
  // member show that email instead of the generic placeholder name — email
  // is the reliable identifier here (it's what actually links the booking
  // to their eventual account), not a looked-up name that may not resolve.
  const resolvedReservations = (reservations ?? []).map(r =>
    r.historical_email
      ? { ...r, profiles: { ...r.profiles, full_name: `${r.historical_email} (pending)` } }
      : r
  )

  return (
    <AllBookingsView
      reservations={resolvedReservations}
      externalBookings={(externalBookings ?? []) as any}
    />
  )
}
