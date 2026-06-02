import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarView from '@/components/CalendarView'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: locations }] = await Promise.all([
    supabase.from('profiles').select('*, companies(*)').eq('id', user.id).single(),
    supabase.from('locations').select('*').order('name'),
  ])

  if (!profile) redirect('/login')

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
    <CalendarView
      locations={locations ?? []}
      profile={profile}
      company={profile.companies ?? null}
      hoursUsed={hoursUsed}
    />
  )
}
