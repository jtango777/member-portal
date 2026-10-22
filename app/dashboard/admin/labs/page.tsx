import { createAdminClient } from '@/lib/supabase/server'
import DeskMap from '@/components/admin/DeskMap'
import { EL_SEGUNDO_MAIN } from '@/lib/deskPlans'

export const dynamic = 'force-dynamic'

// Labs: things being tried out before they earn a place of their own in the
// menu. For now that is the El Segundo desk map (Joe, 2026-10-21). Gated to
// admins by the layout, so the service-role client is fine here.
export default async function AdminLabsPage() {
  const { data, error } = await createAdminClient()
    .from('desk_assignments')
    .select('desk, name')
    .eq('plan', EL_SEGUNDO_MAIN.id)

  if (error) console.error('[admin/labs] Could not load desk assignments:', error.message)

  const names = Object.fromEntries((data ?? []).map(r => [r.desk, r.name])) as Record<string, string>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Labs</h1>
        <p className="text-sm text-gray-500 mt-1">Experimental tools. Things here may change or move.</p>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          The desk map could not load its saved names. If this is a new install, the
          database needs migration <code>059_desk_assignments.sql</code>.
        </div>
      ) : (
        <DeskMap plan={EL_SEGUNDO_MAIN} initialNames={names} />
      )}
    </div>
  )
}
