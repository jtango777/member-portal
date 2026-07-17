import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DoorOpen, Smile } from 'lucide-react'
import { newFacesCutoff } from '@/lib/newFaces'

export const dynamic = 'force-dynamic'

function formatBookingTime(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const isToday = start.toDateString() === now.toDateString()
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today, ${time}`
  const isTomorrow = start.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()
  if (isTomorrow) return `Tomorrow, ${time}`
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

export default async function PortalHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, default_location_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const { data: upcoming } = await supabase
    .from('reservations')
    .select('start_time, rooms(name)')
    .eq('user_id', user.id)
    .gte('end_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  let newFacesCount = 0
  if (profile.default_location_id) {
    const cutoff = newFacesCutoff().toISOString()

    const [{ count: profilesCount }, { count: directoryCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('default_location_id', profile.default_location_id)
        .eq('is_active', true)
        .not('avatar_url', 'is', null)
        .gte('created_at', cutoff),
      supabase
        .from('directory_photos')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', profile.default_location_id)
        .gte('created_at', cutoff),
    ])
    newFacesCount = (profilesCount ?? 0) + (directoryCount ?? 0)
  }

  let spotlight: { full_name: string; avatar_url: string } | null = null
  if (profile.default_location_id) {
    const [{ data: locationProfiles }, { data: locationDirectory }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('default_location_id', profile.default_location_id)
        .eq('is_active', true)
        .not('avatar_url', 'is', null)
        .neq('id', user.id),
      supabase
        .from('directory_photos')
        .select('id, full_name, avatar_url')
        .eq('location_id', profile.default_location_id),
    ])
    const candidates = [...(locationProfiles ?? []), ...(locationDirectory ?? [])]
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      spotlight = { full_name: pick.full_name, avatar_url: pick.avatar_url }
    }
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Next booking</p>
            <p className="text-base font-semibold text-gray-900">
              {upcoming ? formatBookingTime(upcoming.start_time) : 'No current booking!'}
            </p>
          </div>
          <Link href="/dashboard/haus-smiles/new" className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 block">
            <p className="text-xs text-gray-500 mb-1">Community</p>
            <p className="text-base font-semibold text-gray-900">
              {newFacesCount > 0 ? `${newFacesCount} new face${newFacesCount === 1 ? '' : 's'}` : 'No new faces yet'}
            </p>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Link href="/dashboard/rooms"
            className="bg-blue-50 hover:bg-blue-100 transition-colors rounded-lg p-4 flex flex-col gap-2">
            <DoorOpen size={20} className="text-blue-700" />
            <span className="text-sm font-semibold text-blue-900">Rooms</span>
          </Link>

          <Link href="/dashboard/haus-smiles"
            className="bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-lg p-4 flex flex-col gap-2">
            <Smile size={20} className="text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-900">Haus Smiles</span>
            {spotlight && (
              <div className="flex items-center gap-2 mt-1 pt-3 border-t border-emerald-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spotlight.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-emerald-700">Meet a neighbor</p>
                  <p className="text-xs font-semibold text-emerald-900">{firstName(spotlight.full_name)}</p>
                </div>
              </div>
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
