import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import DeskMap from '@/components/admin/DeskMap'
import { deskPlanBySlug } from '@/lib/deskPlans'

export const dynamic = 'force-dynamic'

// One seating chart from Labs. Gated to admins by the layout, so the
// service-role client is fine here.
export default async function AdminSeatingChartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const plan = deskPlanBySlug(slug)
  if (!plan) notFound()

  const { data, error } = await createAdminClient()
    .from('desk_assignments')
    .select('desk, name')
    .eq('plan', plan.id)

  if (error) console.error(`[admin/labs/${slug}] Could not load desk assignments:`, error.message)

  const names = Object.fromEntries((data ?? []).map(r => [r.desk, r.name])) as Record<string, string>

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/admin/labs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ChevronLeft size={16} /> Labs
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">{plan.title}</h1>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          The chart could not load its saved names. If this is a new install, the
          database needs migration <code>059_desk_assignments.sql</code>.
        </div>
      ) : (
        <DeskMap plan={plan} initialNames={names} />
      )}
    </div>
  )
}
