import { createClient } from '@/lib/supabase/server'
import AllReservationsView from '@/components/admin/AllReservationsView'

export const dynamic = 'force-dynamic'

export default async function AdminReservationsPage() {
  const supabase = await createClient()

  const { data: reservations } = await supabase
    .from('reservations')
    .select('*, profiles(id, full_name), companies(id, name), rooms(id, name, location_id)')
    .order('start_time', { ascending: true })

  return <AllReservationsView reservations={reservations ?? []} />
}
