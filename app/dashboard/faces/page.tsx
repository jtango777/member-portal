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

  // hidden_from_faces lets a profile (or, as of 2026-09-14, a pending
  // invite too) stay fully active everywhere else without showing up on
  // Faces — e.g. a known-virtual member who doesn't belong in a "who's
  // physically here" directory. Hidden for everyone by default, admins
  // included, UNLESS the admin explicitly asks to see hidden faces (the
  // toggle in HausSmilesTabs) — so admins always fetch every row
  // (hidden_from_faces selected either way) and filter client-side, while
  // non-admins never even receive a hidden row from the server at all.
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, avatar_url, default_location_id, seating, linkedin_username, hidden_from_faces')
    .eq('is_active', true)
    .order('full_name')
  if (!isAdmin) profilesQuery = profilesQuery.eq('hidden_from_faces', false)

  // No longer requires avatar_url either — a pending member is still real
  // and worth the same nudge, whether or not they've signed in yet.
  // Caught 2026-09-14.
  let pendingQuery = supabase
    .from('permitted_emails')
    .select('id, full_name, avatar_url, default_location_id, hidden_from_faces')
    .is('accepted_at', null)
    .eq('is_active', true)
    .order('full_name')
  if (!isAdmin) pendingQuery = pendingQuery.eq('hidden_from_faces', false)

  const [{ data: locations }, { data: profiles }, { data: pendingMembers }] = await Promise.all([
    supabase.from('locations').select('*').order('name'),
    profilesQuery,
    pendingQuery,
  ])

  // Faces only shows people formally linked to someone on the Members page —
  // a real registered profile or any pending invite — never a
  // directory_photos entry, which isn't tied to any invite or account at
  // all. As of 2026-09-14 this deliberately includes every pending invite
  // regardless of photo or invite status, not just ones a photo's already
  // been linked to — doubling as a live visual count of who still needs a
  // picture, gray faces and all.
  const allMembers = [
    ...(profiles ?? []).map(p => ({
      id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, location_id: p.default_location_id, seating: p.seating, linkedin_username: p.linkedin_username, hidden_from_faces: p.hidden_from_faces, source: 'profile' as const,
    })),
    ...(pendingMembers ?? []).map(p => ({
      id: p.id, full_name: p.full_name ?? 'Pending member', avatar_url: p.avatar_url, location_id: p.default_location_id, seating: null, linkedin_username: null, hidden_from_faces: p.hidden_from_faces, source: 'pending' as const,
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
