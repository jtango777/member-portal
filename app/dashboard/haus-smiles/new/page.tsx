import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { newFacesCutoff } from '@/lib/newFaces'

export const dynamic = 'force-dynamic'

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default async function NewFacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_location_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  let newFaces: { id: string; full_name: string; avatar_url: string }[] = []

  if (profile.default_location_id) {
    const cutoff = newFacesCutoff().toISOString()

    const [{ data: newProfiles }, { data: newDirectoryPhotos }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('default_location_id', profile.default_location_id)
        .eq('is_active', true)
        .not('avatar_url', 'is', null)
        .gte('created_at', cutoff),
      supabase
        .from('directory_photos')
        .select('id, full_name, avatar_url')
        .eq('location_id', profile.default_location_id)
        .gte('created_at', cutoff),
    ])

    newFaces = [
      ...(newProfiles ?? []),
      ...(newDirectoryPhotos ?? []),
    ].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Back to Member Portal
        </Link>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">New faces</h1>
        <p className="text-sm text-gray-500 mb-6">Members who joined your location in the last 2 months.</p>

        {newFaces.length === 0 ? (
          <p className="text-sm text-gray-500">No new faces yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {newFaces.map(member => (
              <div key={member.id} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.avatar_url}
                  alt={member.full_name}
                  className="w-full aspect-square object-cover rounded-lg border-4 border-blue-500 mb-2"
                />
                <p className="text-sm text-gray-700">{firstNameLastInitial(member.full_name)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
