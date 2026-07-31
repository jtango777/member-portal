import { createClient } from '@/lib/supabase/server'
import { getAuthedProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'
import CalendarView from '@/components/CalendarView'
import RoomsNotSetUp from '@/components/RoomsNotSetUp'
import PageVisitTracker from '@/components/PageVisitTracker'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const profile = await getAuthedProfile()
  if (!profile) redirect('/login')
  const supabase = await createClient()

  const noCompany = !profile.is_admin && !profile.company_id

  if (noCompany) {
    return (
      <>
        <PageVisitTracker path="/dashboard/rooms" />
        <RoomsNotSetUp
          alreadyRequested={!!profile.room_access_requested_at}
          contactEmail={process.env.STAFF_NOTIFICATION_EMAIL ?? 'bookings@bizhaus.com'}
        />
      </>
    )
  }

  const { data: locations } = await supabase.from('locations').select('*').order('name')

  // Calculate hours used for current month (non-admin users)
  let hoursUsed = 0
  if (!profile.is_admin && profile.company_id) {
    const { start, end } = getMonthBounds(new Date())
    const { data: monthRes } = await supabase
      .from('reservations')
      .select('start_time, end_time')
      .eq('company_id', profile.company_id)
      .gte('start_time', start)
      .lte('end_time', end)
    if (monthRes) hoursUsed = calcHoursUsed(monthRes)
  }

  return (
    <>
      <PageVisitTracker path="/dashboard/rooms" />
      <CalendarView
        locations={locations ?? []}
        profile={profile}
        company={profile.companies ?? null}
        hoursUsed={hoursUsed}
        defaultLocationId={profile.default_location_id ?? null}
      />
    </>
  )
}
