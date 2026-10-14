import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  buildChannelMonths,
  readDayPassMonths,
  type ChannelIssue,
  type DayPassChannelReport,
  type MonthTotals,
} from '@/lib/dayPassChannels'
import {
  formatMonthKey,
  getPacificMonthBounds,
  nextMonthKey,
  pacificDateKey,
  recentPacificMonths,
} from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Total day pass sales from QuickBooks, the self-serve share of it from our
// own records, and the front desk as the difference. See lib/dayPassChannels
// for why the two halves have to come from two different systems.

const MONTHS_SHOWN = 6

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const months = recentPacificMonths(MONTHS_SHOWN)
  const firstMonth = months[0]
  const lastMonth = months[months.length - 1]

  const admin = createAdminClient()

  const { data: locations, error: locError } = await admin
    .from('locations')
    .select('id, name, qb_day_pass_item')
    .order('name')

  if (locError || !locations) {
    console.error('[admin/reports] Day pass channels, locations failed:', locError?.message)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }

  // ── Total, from QuickBooks ────────────────────────────────────────────────
  //
  // QuickBooks filters TxnDate against the company file's own time zone,
  // which is Pacific for all three entities, so plain date strings are right
  // here. The end is the first of the month after the last one shown,
  // compared with <, so no day is counted twice or missed.
  const qbStart = `${firstMonth}-01`
  const qbEnd = `${nextMonthKey(lastMonth)}-01`

  const qb: MonthTotals = { revenue: {}, counts: {}, matchedAnything: false }
  const issues: ChannelIssue[] = []

  for (const location of locations) {
    const { totals, issues: locIssues } = await readDayPassMonths(
      location.id,
      location.name,
      // Per location on purpose: the three company files do not have to name
      // this product the same, and assuming "Day Pass" everywhere would read
      // zero for any location that renamed it.
      location.qb_day_pass_item ?? 'Day Pass',
      qbStart,
      qbEnd
    )
    for (const [month, amount] of Object.entries(totals.revenue)) {
      qb.revenue[month] = (qb.revenue[month] ?? 0) + amount
    }
    for (const [month, count] of Object.entries(totals.counts)) {
      qb.counts[month] = (qb.counts[month] ?? 0) + count
    }
    qb.matchedAnything = qb.matchedAnything || totals.matchedAnything
    issues.push(...locIssues)
  }

  // ── Self-serve, from our own database ─────────────────────────────────────
  //
  // Bucketed by created_at, the moment of purchase, not by `date`, the day
  // the pass is for. The QuickBooks side above is keyed on the receipt date,
  // which is the purchase date, and a pass bought today for three weeks out
  // would otherwise land in a different month on each side and make desk
  // sales come out negative.
  const { start } = getPacificMonthBounds(firstMonth)
  const { end } = getPacificMonthBounds(lastMonth)

  const { data: passes, error: passError } = await admin
    .from('day_passes')
    .select('price_cents, created_at')
    .eq('status', 'confirmed')
    .gte('created_at', start)
    .lte('created_at', end)

  if (passError) {
    console.error('[admin/reports] Day pass channels, day_passes failed:', passError.message)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }

  const selfServeRevenue: Record<string, number> = {}
  const selfServeCount: Record<string, number> = {}
  for (const pass of passes ?? []) {
    const month = pacificDateKey(new Date(pass.created_at)).slice(0, 7)
    selfServeRevenue[month] = (selfServeRevenue[month] ?? 0) + pass.price_cents / 100
    selfServeCount[month] = (selfServeCount[month] ?? 0) + 1
  }

  const report: DayPassChannelReport = {
    months: buildChannelMonths(months, formatMonthKey, qb, selfServeRevenue, selfServeCount),
    issues,
    // From a QuickBooks export, so it is the same measure as the total
    // column and can sit beside it honestly.
    baseline: { label: 'Aug 1 to Sep 25 2026, before launch', passesPerMonth: 29, revenuePerMonth: 919 },
    launchMonthLabel: 'September 30 2026',
  }

  return NextResponse.json(report)
}
