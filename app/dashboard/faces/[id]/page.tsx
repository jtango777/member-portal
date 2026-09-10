import { createClient } from '@/lib/supabase/server'
import { getAuthedProfile } from '@/lib/supabase/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import HausSmilesMemberActions from '@/components/HausSmilesMemberActions'
import { linkedinUrl } from '@/lib/linkedin'

export const dynamic = 'force-dynamic'

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default async function HausSmilesMemberPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ location?: string }>
}) {
  const { id } = await params
  const { location } = await searchParams
  const currentProfile = await getAuthedProfile()
  if (!currentProfile) redirect('/login')
  const supabase = await createClient()

  const { data: profileMember } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, seating, linkedin_username')
    .eq('id', id)
    .eq('is_active', true)
    .not('avatar_url', 'is', null)
    .single()

  const pendingMember = profileMember ? null : (
    await supabase
      .from('permitted_emails')
      .select('id, full_name, avatar_url')
      .eq('id', id)
      .is('accepted_at', null)
      .eq('is_active', true)
      .not('avatar_url', 'is', null)
      .single()
  ).data

  const member = profileMember ?? pendingMember ?? (
    await supabase
      .from('directory_photos')
      .select('id, full_name, avatar_url')
      .eq('id', id)
      .single()
  ).data

  if (!member) notFound()

  const source: 'profile' | 'pending' | 'directory' = profileMember ? 'profile' : pendingMember ? 'pending' : 'directory'

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-sm mx-auto">
        <Link href={`/dashboard/faces${location ? `?location=${location}` : ''}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Back to Faces
        </Link>
        <div className="relative mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.avatar_url ?? ''}
            alt={member.full_name}
            className="w-full aspect-square object-cover rounded-xl border border-gray-200"
          />
          {(member as { linkedin_username?: string | null }).linkedin_username && (
            <a
              href={linkedinUrl((member as { linkedin_username?: string | null }).linkedin_username!)}
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn"
              className="absolute bottom-2 right-2 flex items-center justify-center w-7 h-7 rounded-[6px] bg-[#0A66C2] shadow-sm hover:scale-110 transition-transform"
            >
              {/* Same real "in" mark as the Faces grid badge — this page had
                  been left on the old outline-icon version. */}
              <svg viewBox="0 0 24 24" width={19} height={19} fill="white">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
              </svg>
            </a>
          )}
        </div>
        <p className="text-lg font-semibold text-gray-900 text-center">{firstNameLastInitial(member.full_name)}</p>
        {(member as { seating?: string | null }).seating && (
          <p className="text-sm text-gray-400 text-center">{(member as { seating?: string | null }).seating}</p>
        )}
        {currentProfile?.is_admin && (
          <HausSmilesMemberActions id={member.id} source={source} fullName={member.full_name} avatarUrl={member.avatar_url} />
        )}
      </div>
    </div>
  )
}
