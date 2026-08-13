import { createClient } from '@/lib/supabase/server'
import ReportsHub from '@/components/admin/ReportsHub'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  // Earliest reservation on file — the month picker covers everything back
  // to here instead of a fixed lookback window, so it doesn't silently
  // drop older months as history accumulates.
  const { data } = await supabase
    .from('reservations')
    .select('start_time')
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  const earliestMonth = data?.start_time ? data.start_time.slice(0, 7) : null

  return <ReportsHub earliestMonth={earliestMonth} />
}
