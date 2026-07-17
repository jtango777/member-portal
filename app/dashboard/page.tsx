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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-1.5 bg-blue-600" />
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Member Portal
          </h1>
        </div>

        <p className="text-sm text-gray-400 mb-1 mt-6">Welcome back</p>
        <h2 className="text-xl font-semibold text-gray-900 mb-8">{profile.full_name}</h2>

        <div className="grid grid-cols-1 gap-5">
          <Link href="/dashboard/rooms"
            className="bg-blue-50 hover:bg-blue-100 transition-colors rounded-2xl p-8 flex flex-col gap-2 min-h-[160px] justify-center">
            <DoorOpen size={28} className="text-blue-700" />
            <span className="text-lg font-semibold text-blue-900">Rooms</span>
            <span className="text-sm text-blue-700">Book a conference room</span>
          </Link>

          <Link href="/dashboard/haus-smiles"
            className="bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-2xl p-8 flex flex-col gap-2 min-h-[160px] justify-center">
            <Smile size={28} className="text-emerald-700" />
            <span className="text-lg font-semibold text-emerald-900">Haus Smiles</span>
            <span className="text-sm text-emerald-700">Meet your community</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
