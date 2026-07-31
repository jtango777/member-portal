import { createClient } from '@/lib/supabase/server'
import { getAuthedProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'
import HausSmilesTabs from '@/components/HausSmilesTabs'
import PageVisitTracker from '@/components/PageVisitTracker'

export const dynamic = 'force-dynamic'

export default async function HausSmilesPage() {
  const currentProfile = await getAuthedProfile()
  if (!currentProfile) redirect('/login')
  const supabase = await createClient()

  const [{ data: locations }, { data: profiles }, { data: directoryPhotos }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, default_location_id, seating')
      .not('avatar_url', 'is', null)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('directory_photos')
      .select('id, full_name, avatar_url, location_id')
      .order('full_name'),
  ])

  const allMembers = [
    ...(profiles ?? []).map(p => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, location_id: p.default_location_id, seating: p.seating, source: 'profile' as const })),
    ...(directoryPhotos ?? []).map(d => ({ id: d.id, full_name: d.full_name, avatar_url: d.avatar_url, location_id: d.location_id, seating: null, source: 'directory' as const })),
  ]

  const groups = (locations ?? [])
    .map(location => ({
      key: location.id,
      name: location.name,
      members: allMembers.filter(p => p.location_id === location.id).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    }))
    .filter(g => g.members.length > 0)

  return (
    <div className="h-full overflow-auto p-6">
      <PageVisitTracker path="/dashboard/haus-smiles" />
      <div className="max-w-5xl mx-auto">
        <HausSmilesTabs groups={groups} defaultLocationId={currentProfile?.default_location_id ?? null} isAdmin={currentProfile?.is_admin ?? false} />
      </div>
    </div>
  )
}
