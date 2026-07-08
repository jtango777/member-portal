import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HausSmilesTabs from '@/components/HausSmilesTabs'
import PageVisitTracker from '@/components/PageVisitTracker'

export const dynamic = 'force-dynamic'

export default async function HausSmilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: locations } = await supabase.from('locations').select('*').order('name')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, default_location_id')
    .not('avatar_url', 'is', null)
    .eq('is_active', true)
    .order('full_name')

  const groups = [
    ...(locations ?? []).map(location => ({
      key: location.id,
      name: location.name,
      members: (profiles ?? []).filter(p => p.default_location_id === location.id),
    })),
    {
      key: 'other',
      name: 'Other',
      members: (profiles ?? []).filter(p => !p.default_location_id),
    },
  ].filter(g => g.members.length > 0)

  return (
    <div className="h-full overflow-auto p-6">
      <PageVisitTracker path="/dashboard/haus-smiles" />
      <div className="max-w-5xl mx-auto">
        <HausSmilesTabs groups={groups} />
      </div>
    </div>
  )
}
