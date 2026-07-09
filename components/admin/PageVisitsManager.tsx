'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { Search, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'

type Visit = {
  id: string
  path: string
  started_at: string
  duration_seconds: number
  full_name: string | null
  email: string | null
}

type Summary = {
  key: string
  full_name: string | null
  email: string | null
  path: string
  visit_count: number
  total_duration: number
  visits: Visit[]
}

const PATH_LABELS: Record<string, string> = {
  '/dashboard/rooms': 'Rooms',
  '/dashboard/haus-smiles': 'Member Directory',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export default function PageVisitsManager() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/reports/page-visits')
    if (r.ok) setVisits(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Group into one row per person + page, showing how many times they visited
  const summaries: Summary[] = Object.values(
    visits.reduce((acc, v) => {
      const key = `${v.email ?? 'unknown'}::${v.path}`
      if (!acc[key]) {
        acc[key] = {
          key, full_name: v.full_name, email: v.email, path: v.path,
          visit_count: 0, total_duration: 0, visits: [],
        }
      }
      acc[key].visit_count += 1
      acc[key].total_duration += v.duration_seconds
      acc[key].visits.push(v)
      return acc
    }, {} as Record<string, Summary>)
  ).sort((a, b) => b.visit_count - a.visit_count)

  const q = search.toLowerCase()
  const filtered = summaries.filter(s =>
    !q ||
    (s.full_name ?? '').toLowerCase().includes(q) ||
    (s.email ?? '').toLowerCase().includes(q) ||
    (PATH_LABELS[s.path] ?? s.path).toLowerCase().includes(q)
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Page Activity</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visit counts for Rooms and Member Directory. Click a row to see who and when.</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Search by name, email, or page…" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[6%]" /><col className="w-[28%]" /><col className="w-[28%]" /><col className="w-[18%]" /><col className="w-[10%]" /><col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th></th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Page</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Visits</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Total Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <Fragment key={s.key}>
                <tr onClick={() => setExpanded(expanded === s.key ? null : s.key)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                  <td className="px-2 py-2.5 text-gray-400">
                    {expanded === s.key ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900 truncate" title={s.full_name ?? undefined}>{s.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 truncate" title={s.email ?? undefined}>{s.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700 truncate">{PATH_LABELS[s.path] ?? s.path}</td>
                  <td className="px-4 py-2.5 text-gray-700">{s.visit_count}</td>
                  <td className="px-4 py-2.5 text-gray-700">{formatDuration(s.total_duration)}</td>
                </tr>
                {expanded === s.key && (
                  <tr>
                    <td colSpan={6} className="bg-gray-50 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left font-medium pb-1.5 pl-6">Visited</th>
                            <th className="text-left font-medium pb-1.5">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.visits
                            .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                            .map(v => (
                              <tr key={v.id} className="border-t border-gray-200">
                                <td className="py-1.5 pl-6 text-gray-700">{formatShortDate(new Date(v.started_at))}</td>
                                <td className="py-1.5 text-gray-700">{formatDuration(v.duration_seconds)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">No page visits recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
