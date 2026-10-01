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

  // A booking made from /book writes an external_bookings row AND a
  // placeholder reservation to hold the slot. The placeholder has no member
  // attached, so it showed up in the Internal tab as "External Booking —
  // <name>" with Booked by and Company empty, and counted again in All, so
  // every external booking appeared twice (Caroline, 2026-10-01). Drop the
  // placeholders here: the real booking is already in the External tab with
  // the guest, their company and what they paid.
  const placeholderIds = new Set(
    (externalBookings ?? []).map(b => b.reservation_id).filter(Boolean) as string[]
  )
  const memberReservations = (reservations ?? []).filter(r => !placeholderIds.has(r.id))

  const resolvedReservations = await resolveHistoricalBookings(supabase, memberReservations)

  return (
    <ConferenceRoomsTabs
      reservations={resolvedReservations}
      externalBookings={(externalBookings ?? []) as any}
      locations={locations ?? []}
      rooms={rooms ?? []}
    />
  )
}
