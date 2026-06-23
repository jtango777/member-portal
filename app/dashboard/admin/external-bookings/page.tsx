import { createClient } from '@/lib/supabase/server'
import ExternalBookingsQueue from '@/components/admin/ExternalBookingsQueue'

export const dynamic = 'force-dynamic'

export default async function ExternalBookingsPage() {
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('external_bookings')
    .select('*, rooms(name, external_name, price_per_hour, locations(name))')
    .order('created_at', { ascending: false })

  return <ExternalBookingsQueue bookings={(bookings ?? []) as any} />
}
