import { createAdminClient } from '@/lib/supabase/server'
import DayPassesManager from '@/components/admin/DayPassesManager'

export const dynamic = 'force-dynamic'

// day_passes/booking_customers RLS deliberately only lets a customer read
// their own rows (see migration 044) — this page is already gated to
// admins at the layout level, so it uses the service-role client to see
// everyone's, same convention as the rest of the admin dashboard.
export default async function AdminDayPassesPage() {
  const supabase = createAdminClient()

  const { data: dayPasses } = await supabase
    .from('day_passes')
    .select('*, booking_customers(id, first_name, last_name, email), locations(id, name)')
    .order('date', { ascending: false })

  return <DayPassesManager dayPasses={(dayPasses ?? []) as any} />
}
