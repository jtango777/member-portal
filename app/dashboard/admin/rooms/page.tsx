import { createClient } from '@/lib/supabase/server'
import RoomsManager from '@/components/admin/RoomsManager'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const supabase = await createClient()

  const [{ data: locations }, { data: rooms }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    supabase.from('rooms').select('*').order('sort_order'),
  ])

  return <RoomsManager locations={locations ?? []} initialRooms={rooms ?? []} />
}
