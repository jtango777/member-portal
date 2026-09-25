import { createClient } from '@/lib/supabase/server'
import RoomSettingsTabs from '@/components/admin/RoomSettingsTabs'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const supabase = await createClient()

  const [{ data: locations }, { data: rooms }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    supabase.from('rooms').select('*').order('sort_order'),
  ])

  // Internal and external rooms are two different jobs, so they're tabs now
  // rather than one long page; the public booking site's closed days live
  // under External with the rooms they affect (Caroline, 2026-09-25).
  return <RoomSettingsTabs locations={locations ?? []} rooms={rooms ?? []} />
}
