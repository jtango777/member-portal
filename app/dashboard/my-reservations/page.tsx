import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAuthedUser, getAuthedProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'
import { resolveHistoricalBookings } from '@/lib/resolveHistoricalBookings'
import MyReservationsList from '@/components/MyReservationsList'

export const dynamic = 'force-dynamic'

export default async function MyReservationsPage() {
  const user = await getAuthedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const [
    profileData,
    { data: myReservations },
    { data: rooms },
  ] = await Promise.all([
    getAuthedProfile(),
    supabase.from('reservations')
      .select('*, rooms(name, locations(name)), profiles(full_name)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false }),
    supabase.from('rooms').select('*, locations(*)').order('name'),
  ])

  if (!profileData) redirect('/login')

  // Admin client for the historical-email lookup specifically — RLS on
  // permitted_emails can silently starve this under a regular member's
  // session.
  const admin = createAdminClient()

  // Fetch company-wide or all reservations
  let companyReservations: any[] = []
  if (profileData.is_admin) {
    const { data } = await supabase
      .from('reservations')
      .select('*, rooms(name, locations(name)), profiles(full_name), companies(name)')
      .order('start_time', { ascending: false })
    companyReservations = await resolveHistoricalBookings(admin, (data ?? []).filter((r: any) => r.user_id !== user.id))
  } else if (profileData.company_id) {
    const { data } = await supabase
      .from('reservations')
      .select('*, rooms(name, locations(name)), profiles(full_name)')
      .eq('company_id', profileData.company_id)
      .neq('user_id', user.id)
      .order('start_time', { ascending: false })
    companyReservations = await resolveHistoricalBookings(admin, data ?? [])
  }

  // Calculate hours used this month
  let hoursUsed = 0
  if (!profileData.is_admin && profileData.company_id) {
    const { start, end } = getMonthBounds(new Date())
    const { data: monthRes } = await supabase
      .from('reservations')
      .select('start_time, end_time')
      .eq('company_id', profileData.company_id)
      .gte('start_time', start)
      .lte('end_time', end)
    if (monthRes) hoursUsed = calcHoursUsed(monthRes)
  }

  const now      = new Date()
  const upcoming = (myReservations ?? []).filter(r => new Date(r.start_time) >= now)
  const past     = (myReservations ?? []).filter(r => new Date(r.start_time) <  now)

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <MyReservationsList
          upcoming={upcoming}
          past={past}
          companyReservations={companyReservations}
          rooms={rooms ?? []}
          profile={profileData}
          company={profileData.companies ?? null}
          hoursUsed={hoursUsed}
        />
      </div>
    </div>
  )
}
