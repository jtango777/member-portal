import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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

  // Reading AND flipping profile.welcomed both happen right here, in one
  // place — moved out of app/dashboard/page.tsx, which used to do its own
  // separate read-then-write of the same field. Layout and page fetch
  // their own profile independently in Next.js (no shared cache), so on
  // the very first dashboard visit after signup there was a race: if
  // page.tsx's write landed before this component's own read resolved,
  // isFirstSignIn read back false on the actual first visit, and the
  // onboarding photo/LinkedIn prompt silently never showed. Caught
  // 2026-09-11 (jomobile tester's fresh signup never saw the prompt).
  const isFirstSignIn = !(profile as Profile).welcomed
  if (isFirstSignIn) {
    await createAdminClient().from('profiles').update({ welcomed: true }).eq('id', (profile as Profile).id)
  }

  const shouldShowAnnouncement = !!latestAnnouncement && latestAnnouncement.id !== (profile as Profile).dismissed_announcement_id

  // Same check as the Rooms page's own "not set up for room access yet"
  // gate — used here to hide the My Reservations nav link for someone in
  // that state. Caught 2026-09-10: a member with no company and no
  // individual hours allotment could still see and open My Reservations
  // from the sidebar, even though Rooms itself shows them a "request
  // access" page instead of the calendar.
  const hasRoomAccess = (profile as Profile).is_admin
    || !!(profile as Profile).company_id
    || !!(profile as Profile).individual_hours_allotment

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Nav profile={profile as Profile} />
      <OnboardingOverlays
        avatarUrl={(profile as Profile).avatar_url}
        isFirstSignIn={isFirstSignIn}
        avatarPromptDismissed={(profile as Profile).avatar_prompt_dismissed}
        announcement={shouldShowAnnouncement && latestAnnouncement ? latestAnnouncement : null}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isAdmin={(profile as Profile).is_admin} hasRoomAccess={hasRoomAccess} />
        <main className="flex-1 overflow-hidden" data-dashboard-main>
          {children}
        </main>
      </div>
      <MobileTabBar isAdmin={(profile as Profile).is_admin} hasRoomAccess={hasRoomAccess} />
    </div>
  )
}
