import { createClient } from '@/lib/supabase/server'
import { getAuthedProfile } from '@/lib/supabase/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import HausSmilesMemberActions from '@/components/HausSmilesMemberActions'

export const dynamic = 'force-dynamic'

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default async function HausSmilesMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentProfile = await getAuthedProfile()
  if (!currentProfile) redirect('/login')
  const supabase = await createClient()

  const { data: profileMember } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, seating')
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
        <Link href="/dashboard/haus-smiles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Back to Faces
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.avatar_url ?? ''}
          alt={member.full_name}
          className="w-full aspect-square object-cover rounded-xl border border-gray-200 mb-4"
        />
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
