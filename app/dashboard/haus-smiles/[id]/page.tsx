import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default async function HausSmilesMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileMember } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', id)
    .eq('is_active', true)
    .not('avatar_url', 'is', null)
    .single()

  const member = profileMember ?? (
    await supabase
      .from('directory_photos')
      .select('id, full_name, avatar_url')
      .eq('id', id)
      .single()
  ).data

  if (!member) notFound()

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-sm mx-auto">
        <Link href="/dashboard/haus-smiles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Back to Haus Smiles
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.avatar_url ?? ''}
          alt={member.full_name}
          className="w-full aspect-square object-cover rounded-xl border border-gray-200 mb-4"
        />
        <p className="text-lg font-semibold text-gray-900 text-center">{firstNameLastInitial(member.full_name)}</p>
      </div>
    </div>
  )
}
