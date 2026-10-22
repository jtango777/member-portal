import Link from 'next/link'
import { ArrowUpRight, LayoutGrid } from 'lucide-react'
import { DESK_PLAN_LIST } from '@/lib/deskPlans'

// Labs: things being tried out before they earn a place of their own in the
// menu. For now, a seating chart per location (Joe, 2026-10-22).
export default function AdminLabsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Labs</h1>
        <p className="text-sm text-gray-500 mt-1">Experimental tools. Things here may change or move.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 max-w-xl">
        {DESK_PLAN_LIST.map(plan => (
          <Link key={plan.id} href={`/dashboard/admin/labs/${plan.slug}`}
            className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition">
            <div className="flex items-start justify-between gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <LayoutGrid size={18} className="text-blue-500" />
              </div>
              <ArrowUpRight size={16} className="text-gray-300 group-hover:text-blue-500" />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-gray-900">{plan.title}</h2>
            <p className="text-xs text-gray-500 mt-1">{plan.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
