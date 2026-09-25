import { createClient } from '@/lib/supabase/server'
import ConferenceRoomsTabs from '@/components/admin/ConferenceRoomsTabs'
import { resolveHistoricalBookings } from '@/lib/resolveHistoricalBookings'

export const dynamic = 'force-dynamic'

// Everything about conference rooms: bookings, the rooms, and closed days.
// "All Bookings" used to be a separate page, which read as though it covered
// day passes too when it never did (Caroline, 2026-09-25).
export default async function ConferenceRoomsPage() {
  const supabase = await createClient()

  const [{ data: locations }, { data: rooms }, { data: reservations }, { data: externalBookings }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    supabase.from('rooms').select('*').order('sort_order'),
    supabase
      .from('reservations')
      .select('*, profiles(id, full_name), companies(id, name), rooms(id, name, location_id, locations(name))')
      .order('start_time', { ascending: true }),
    supabase
      .from('external_bookings')
      .select('*, rooms(name, external_name, price_per_hour, locations(name))')
      .order('created_at', { ascending: false }),
  ])

  const resolvedReservations = await resolveHistoricalBookings(supabase, reservations ?? [])

  return (
    <ConferenceRoomsTabs
      reservations={resolvedReservations}
      externalBookings={(externalBookings ?? []) as any}
      locations={locations ?? []}
      rooms={rooms ?? []}
    />
  )
}
