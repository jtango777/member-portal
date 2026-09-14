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

  const isAdmin = currentProfile?.is_admin ?? false

  // hidden_from_faces lets a profile stay active and functional (e.g. an
  // admin's own test account) without showing up on Faces at all — hidden
  // for everyone, admins included (2026-09-11: confirmed this isn't an
  // admin-visible exception, just fully off Faces).
  //
  // The no-photo gray placeholder (see HausSmilesTabs) is admin-only —
  // regular members still only ever see people who actually have a photo,
  // same as before. Admins see everyone, including no-photo people, as a
  // live visual count of who still needs a picture. Caught 2026-09-14.
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, avatar_url, default_location_id, seating, linkedin_username')
    .eq('is_active', true)
    .eq('hidden_from_faces', false)
    .order('full_name')
  if (!isAdmin) profilesQuery = profilesQuery.not('avatar_url', 'is', null)

  let pendingQuery = supabase
    .from('permitted_emails')
    .select('id, full_name, avatar_url, default_location_id')
    .is('accepted_at', null)
    .eq('is_active', true)
    .eq('hidden_from_faces', false)
    .order('full_name')
  if (!isAdmin) pendingQuery = pendingQuery.not('avatar_url', 'is', null)

  const [{ data: locations }, { data: profiles }, { data: pendingMembers }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    profilesQuery,
    pendingQuery,
  ])

  // Faces only shows people formally linked to someone on the Members page —
  // a real registered profile or any pending invite — never a
  // directory_photos entry, which isn't tied to any invite or account at
  // all. For admins (only) this deliberately includes every pending invite
  // regardless of photo or invite status, not just ones a photo's already
  // been linked to — doubling as a live visual count of who still needs a
  // picture, gray faces and all.
  const allMembers = [
    ...(profiles ?? []).map(p => ({
      id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, location_id: p.default_location_id, seating: p.seating, linkedin_username: p.linkedin_username, source: 'profile' as const,
    })),
    ...(pendingMembers ?? []).map(p => ({
      id: p.id, full_name: p.full_name ?? 'Pending member', avatar_url: p.avatar_url, location_id: p.default_location_id, seating: null, linkedin_username: null, source: 'pending' as const,
    })),
  ]

  const groups = (locations ?? [])
    .map(location => ({
      key: location.id,
      name: location.name,
      members: allMembers
        .filter(p => p.location_id === location.id)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(p => ({ ...p, location_name: location.name })),
    }))
    .filter(g => g.members.length > 0)

  return (
    <div className="h-full overflow-auto p-6">
      <PageVisitTracker path="/dashboard/faces" />
      <div className="max-w-5xl mx-auto">
        <HausSmilesTabs
          groups={groups}
          defaultLocationId={currentProfile?.default_location_id ?? null}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
