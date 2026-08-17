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

  // Access requires either a company (shared pool) or individual hours
  // assigned directly — a bare account with neither isn't set up for room
  // access yet.
  const noAccess = !profile.is_admin && !profile.company_id && !profile.individual_hours_allotment

  if (noAccess) {
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

  // Hour pool: a real company's shared pool, or (no company) a synthetic
  // pool built from this person's own individual hours, scoped to just them.
  const hourScope: 'company' | 'individual' = profile.company_id ? 'company' : 'individual'
  const hourPool = profile.company_id
    ? (profile.companies ?? null)
    : profile.individual_hours_allotment
      ? { id: profile.id, name: 'Individual', monthly_hours_allotment: profile.individual_hours_allotment, membership_type_id: null, created_at: '', is_active: true, location_id: null, grants_admin: false }
      : null

  // Calculate hours used for current month (non-admin users)
  let hoursUsed = 0
  if (!profile.is_admin && hourPool) {
    const { start, end } = getMonthBounds(new Date())
    let query = supabase
      .from('reservations')
      .select('start_time, end_time')
      .gte('start_time', start)
      .lte('end_time', end)
    query = hourScope === 'individual' ? query.eq('user_id', profile.id) : query.eq('company_id', profile.company_id!)
    const { data: monthRes } = await query
    if (monthRes) hoursUsed = calcHoursUsed(monthRes)
  }

  return (
    <>
      <PageVisitTracker path="/dashboard/rooms" />
      <CalendarView
        locations={locations ?? []}
        profile={profile}
        company={hourPool}
        hourScope={hourScope}
        hoursUsed={hoursUsed}
        defaultLocationId={profile.default_location_id ?? null}
      />
    </>
  )
}
