import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUser, getAuthedProfile } from '@/lib/supabase/session'
import Nav from '@/components/Nav'
import Sidebar from '@/components/Sidebar'
import MobileTabBar from '@/components/MobileTabBar'
import OnboardingOverlays from '@/components/OnboardingOverlays'
import { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const [profile, { data: latestAnnouncement }] = await Promise.all([
    getAuthedProfile(),
    supabase
      .from('announcements')
      .select('id, message')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!profile) redirect('/auth/signout')

  // Archived members could previously still log in and use the whole
  // portal normally — is_active only ever hid them from lists/reports, not
  // access itself. Caught 2026-09-10, right before the mass invite made
  // this the kind of gap that actually matters. Same signout path as a
  // missing profile.
  if (!(profile as Profile).is_active) redirect('/auth/signout')

  const shouldShowAnnouncement = !!latestAnnouncement && latestAnnouncement.id !== (profile as Profile).dismissed_announcement_id

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Nav profile={profile as Profile} />
      <OnboardingOverlays
        hasAvatar={!!(profile as Profile).avatar_url}
        avatarPromptDismissed={(profile as Profile).avatar_prompt_dismissed}
        announcement={shouldShowAnnouncement && latestAnnouncement ? latestAnnouncement : null}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isAdmin={(profile as Profile).is_admin} />
        <main className="flex-1 overflow-hidden" data-dashboard-main>
          {children}
        </main>
      </div>
      <MobileTabBar isAdmin={(profile as Profile).is_admin} />
    </div>
  )
}
