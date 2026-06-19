import { createClient } from '@/lib/supabase/server'
import RoomsManager from '@/components/admin/RoomsManager'
import ExternalRoomsManager from '@/components/admin/ExternalRoomsManager'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const supabase = await createClient()

  const [{ data: locations }, { data: rooms }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    supabase.from('rooms').select('*').order('sort_order'),
  ])

  return (
    <div className="space-y-12">
      <RoomsManager locations={locations ?? []} initialRooms={rooms ?? []} />
      <div className="border-t border-gray-200 pt-10">
        <ExternalRoomsManager locations={locations ?? []} initialRooms={rooms ?? []} />
      </div>
    </div>
  )
}
