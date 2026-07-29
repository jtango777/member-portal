import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import Sidebar from '@/components/Sidebar'
import MobileTabBar from '@/components/MobileTabBar'
import AvatarUploadPrompt from '@/components/AvatarUploadPrompt'
import AnnouncementPopup from '@/components/AnnouncementPopup'
import { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/signout')

  const { data: latestAnnouncement } = await supabase
    .from('announcements')
    .select('id, message')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const shouldShowAnnouncement = !!latestAnnouncement && latestAnnouncement.id !== (profile as Profile).dismissed_announcement_id

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Nav profile={profile as Profile} />
      <AvatarUploadPrompt hasAvatar={!!(profile as Profile).avatar_url} />
      {shouldShowAnnouncement && latestAnnouncement && (
        <AnnouncementPopup announcementId={latestAnnouncement.id} message={latestAnnouncement.message} />
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isAdmin={(profile as Profile).is_admin} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <MobileTabBar isAdmin={(profile as Profile).is_admin} />
    </div>
  )
}
