import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DoorOpen, Smile } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PortalHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-gray-400 mb-1">Welcome back</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">{profile.full_name}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/dashboard/rooms"
            className="bg-blue-50 hover:bg-blue-100 transition-colors rounded-xl p-5 flex flex-col gap-2">
            <DoorOpen size={24} className="text-blue-700" />
            <span className="text-base font-semibold text-blue-900">Rooms</span>
            <span className="text-sm text-blue-700">Book a conference room</span>
          </Link>

          <Link href="/dashboard/haus-smiles"
            className="bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-xl p-5 flex flex-col gap-2">
            <Smile size={24} className="text-emerald-700" />
            <span className="text-base font-semibold text-emerald-900">Member Directory</span>
            <span className="text-sm text-emerald-700">Meet your community</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
