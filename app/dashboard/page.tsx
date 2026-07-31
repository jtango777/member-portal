import { createClient } from '@/lib/supabase/server'
import { getAuthedProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DoorOpen, Smile, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

export default async function PortalHomePage() {
  const profile = await getAuthedProfile()
  if (!profile) redirect('/login')
  const supabase = await createClient()

  // Only ever shows members formally linked to a real profile — not
  // directory_photos entries, which have no account behind them.
  let neighbors: { full_name: string; avatar_url: string }[] = []
  if (profile.default_location_id) {
    const { data: locationProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('default_location_id', profile.default_location_id)
      .eq('is_active', true)
      .not('avatar_url', 'is', null)
      .neq('id', profile.id)
    neighbors = (locationProfiles ?? [])
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(c => ({ full_name: c.full_name, avatar_url: c.avatar_url }))
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-1.5 bg-blue-600" />
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Member Portal
          </h1>
        </div>

        <p className="text-xl font-semibold text-gray-900 mb-6">Welcome back, {profile.full_name}</p>

        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <Link href="/dashboard/rooms"
            className="bg-blue-50 hover:bg-blue-100 active:bg-blue-100 transition-colors rounded-xl p-4 sm:p-8 flex sm:flex-wrap items-center gap-3">
            <DoorOpen size={28} className="text-blue-700 flex-shrink-0 sm:hidden" />
            <DoorOpen size={32} className="text-blue-700 hidden sm:block" />
            <div className="flex-1 min-w-0 sm:flex-none sm:contents">
              <span className="block sm:inline text-lg sm:text-xl font-bold text-blue-900">Rooms</span>
              <div className="h-5 w-px bg-blue-200 hidden sm:block" />
              <span className="block sm:inline text-xs sm:text-sm text-blue-700">Book a conference room</span>
            </div>
            <ChevronRight size={20} className="text-blue-300 flex-shrink-0 sm:hidden" />
          </Link>

          <Link href="/dashboard/haus-smiles"
            className="bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-100 transition-colors rounded-xl p-4 sm:p-8 flex sm:flex-wrap items-center gap-3">
            <Smile size={28} className="text-emerald-700 flex-shrink-0 sm:hidden" />
            <Smile size={32} className="text-emerald-700 hidden sm:block" />
            <div className="flex-1 min-w-0 sm:flex-none sm:contents">
              <span className="block sm:inline text-lg sm:text-xl font-bold text-emerald-900">Faces</span>
              <div className="h-5 w-px bg-emerald-200 hidden sm:block" />
              <span className="block sm:inline text-xs sm:text-sm text-emerald-700">Meet your community</span>
              {neighbors.length > 0 && (
                <span className="block sm:hidden text-xs text-emerald-600 mt-0.5">
                  ({neighbors.map(n => firstName(n.full_name)).join(', ')}...)
                </span>
              )}
            </div>
            {neighbors.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 ml-2 min-w-0">
                <div className="flex -space-x-3 flex-shrink-0">
                  {neighbors.map((n, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={n.avatar_url} alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-emerald-50" />
                  ))}
                </div>
                <span className="text-xs text-emerald-600 whitespace-nowrap">
                  ({neighbors.map(n => firstName(n.full_name)).join(', ')}...)
                </span>
              </div>
            )}
            <ChevronRight size={20} className="text-emerald-300 flex-shrink-0 sm:hidden" />
          </Link>
        </div>
      </div>
    </div>
  )
}
