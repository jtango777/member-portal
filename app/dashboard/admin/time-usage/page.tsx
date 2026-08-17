import { createClient } from '@/lib/supabase/server'
import TimeUsageView from '@/components/admin/TimeUsageView'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'
import { HourSummary, PersonUsage } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TimeUsagePage() {
  const supabase = await createClient()
  const now = new Date()
  const { start, end } = getMonthBounds(now)

  const [{ data: companies }, { data: individuals }, { data: allProfiles }] = await Promise.all([
    supabase.from('companies').select('*').eq('is_active', true).order('name'),
    // Members with their own hour allotment instead of a shared company
    // pool — these never showed up here at all before, since this page
    // only ever iterated companies.
    supabase.from('profiles').select('id, full_name, individual_hours_allotment')
      .is('company_id', null)
      .not('individual_hours_allotment', 'is', null)
      .order('full_name'),
    // Everyone with some kind of hours pool (company or individual), for
    // the per-person "User" view — a company view alone can't show who
    // within a company actually used the hours.
    supabase.from('profiles').select('id, full_name, company_id, individual_hours_allotment, default_location_id, companies(name)')
      .or('company_id.not.is.null,individual_hours_allotment.not.is.null')
      .order('full_name'),
  ])
  if (!companies) return <TimeUsageView summaries={[]} people={[]} month={now} />

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
        is_active: true,
        location_id: null,
      },
      hours_used: used,
      hours_remaining: Math.max(0, allotment - used),
    }
  })

  const summaries = [...companySummaries, ...individualSummaries]
    .sort((a, b) => a.company.name.localeCompare(b.company.name))

  const people: PersonUsage[] = (allProfiles ?? []).map(p => {
    // Their own reservations this month, regardless of whether the booking
    // was made under a shared company pool or as an individual — this is
    // "what did THIS person actually use", not the company's total.
    const personRes = (monthRes ?? []).filter(r => r.user_id === p.id)
    const companyRel = Array.isArray(p.companies) ? p.companies[0] : p.companies
    return {
      id: p.id,
      name: p.full_name ?? 'Unknown',
      company_name: companyRel?.name ?? null,
      default_location_id: p.default_location_id ?? null,
      hours_used: calcHoursUsed(personRes),
      reservation_count: personRes.length,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return <TimeUsageView summaries={summaries} people={people} month={now} />
}
