import { createClient } from '@/lib/supabase/server'
import TimeUsageView from '@/components/admin/TimeUsageView'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'
import { HourSummary } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TimeUsagePage() {
  const supabase = await createClient()
  const now = new Date()
  const { start, end } = getMonthBounds(now)

  const [{ data: companies }, { data: individuals }] = await Promise.all([
    supabase.from('companies').select('*').order('name'),
    // Members with their own hour allotment instead of a shared company
    // pool — these never showed up here at all before, since this page
    // only ever iterated companies.
    supabase.from('profiles').select('id, full_name, individual_hours_allotment')
      .is('company_id', null)
      .not('individual_hours_allotment', 'is', null)
      .order('full_name'),
  ])
  if (!companies) return <TimeUsageView summaries={[]} month={now} />

  // Fetch all reservations this month, for both companies and individuals
  const { data: monthRes } = await supabase
    .from('reservations')
    .select('user_id, company_id, start_time, end_time')
    .gte('start_time', start)
    .lte('end_time', end)

  const companySummaries: HourSummary[] = companies.map(c => {
    const companyRes = (monthRes ?? []).filter(r => r.company_id === c.id)
    const used = calcHoursUsed(companyRes)
    return {
      company: c,
      hours_used: used,
      hours_remaining: Math.max(0, c.monthly_hours_allotment - used),
    }
  })

  const individualSummaries: HourSummary[] = (individuals ?? []).map(p => {
    const personRes = (monthRes ?? []).filter(r => r.user_id === p.id && !r.company_id)
    const used = calcHoursUsed(personRes)
    const allotment = p.individual_hours_allotment ?? 0
    return {
      // Same synthetic-company shape used elsewhere (e.g. the Rooms page's
      // own hour pool) so TimeUsageView doesn't need a separate code path.
      company: {
        id: p.id,
        name: `${p.full_name} (Individual)`,
        monthly_hours_allotment: allotment,
        membership_type_id: null,
        created_at: '',
      },
      hours_used: used,
      hours_remaining: Math.max(0, allotment - used),
    }
  })

  const summaries = [...companySummaries, ...individualSummaries]
    .sort((a, b) => a.company.name.localeCompare(b.company.name))

  return <TimeUsageView summaries={summaries} month={now} />
}
