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

  return (
    <AllBookingsView
      reservations={reservations ?? []}
      externalBookings={(externalBookings ?? []) as any}
    />
  )
}
