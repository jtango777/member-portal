import { createClient } from '@/lib/supabase/server'
import TimeUsageView from '@/components/admin/TimeUsageView'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'
import { HourSummary } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TimeUsagePage() {
  const supabase = await createClient()
  const now = new Date()
  const { start, end } = getMonthBounds(now)

  const { data: companies } = await supabase.from('companies').select('*').order('name')
  if (!companies) return <TimeUsageView summaries={[]} month={now} />

  // Fetch all reservations this month for all companies
  const { data: monthRes } = await supabase
    .from('reservations')
    .select('company_id, start_time, end_time')
    .gte('start_time', start)
    .lte('end_time', end)

  const summaries: HourSummary[] = companies.map(c => {
    const companyRes = (monthRes ?? []).filter(r => r.company_id === c.id)
    const used = calcHoursUsed(companyRes)
    return {
      company: c,
      hours_used: used,
      hours_remaining: Math.max(0, c.monthly_hours_allotment - used),
    }
  })

  return <TimeUsageView summaries={summaries} month={now} />
}
