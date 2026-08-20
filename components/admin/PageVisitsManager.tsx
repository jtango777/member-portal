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
  default_location_id: string | null
}

type PageSummary = {
  path: string
  visit_count: number
  last_visited_at: string
  visits: Visit[]
}

// Person-first: one row per member, with their total activity across every
// page, expandable into a per-page breakdown. The previous version had one
// row per (person, page) pair, which split a single person's activity
// across scattered rows — you couldn't see "how engaged is this member"
// without finding and adding up their rows by hand.
type PersonSummary = {
  key: string
  full_name: string | null
  email: string | null
  default_location_id: string | null
  total_visits: number
  last_visited_at: string
  pages: PageSummary[]
}

const PATH_LABELS: Record<string, string> = {
  '/dashboard/rooms': 'Rooms',
  '/dashboard/faces': 'Faces',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

// Real accordion, not a mount/unmount toggle — the CSS-grid "0fr/1fr" trick
// animates to an unknown content height (a plain max-height guess would
// either clip taller content or leave a jump for shorter content). Content
// stays mounted always; only the grid track (and therefore visible height)
// animates, clipped by overflow-hidden on the inner wrapper.
function Accordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

export default function PageVisitsManager() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationFilter, setLocationFilter] = useState('')
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/reports/page-visits')
    if (r.ok) {
      const data: Visit[] = await r.json()
      setVisits(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])

  // Group into one row per person, each holding a per-page breakdown
  const people: PersonSummary[] = Object.values(
    visits.reduce((acc, v) => {
      const personKey = v.email ?? 'unknown'
      if (!acc[personKey]) {
        acc[personKey] = {
          key: personKey, full_name: v.full_name, email: v.email, default_location_id: v.default_location_id,
          total_visits: 0, last_visited_at: v.started_at, pages: [],
        }
      }
      const person = acc[personKey]
      person.total_visits += 1
      if (new Date(v.started_at) > new Date(person.last_visited_at)) {
        person.last_visited_at = v.started_at
      }
      let page = person.pages.find(p => p.path === v.path)
      if (!page) {
        page = { path: v.path, visit_count: 0, last_visited_at: v.started_at, visits: [] }
        person.pages.push(page)
      }
      page.visit_count += 1
      if (new Date(v.started_at) > new Date(page.last_visited_at)) {
        page.last_visited_at = v.started_at
      }
      page.visits.push(v)
      return acc
    }, {} as Record<string, PersonSummary>)
  ).sort((a, b) => b.total_visits - a.total_visits)

  const q = search.toLowerCase()
  const filtered = people.filter(p => {
    if (locationFilter && p.default_location_id !== locationFilter) return false
    return !q ||
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      p.pages.some(pg => (PATH_LABELS[pg.path] ?? pg.path).toLowerCase().includes(q))
  })

  function togglePerson(key: string) {
    setExpandedPeople(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function togglePage(key: string) {
    setExpandedPages(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Page Activity</h1>
        <p className="text-sm text-gray-500 mt-0.5">How active each member is, and which pages they use. Click a row to expand it.</p>
      </div>

      {/* Search + Location filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Search by name, email, or page…" />
        </div>
        {locations.length > 0 && (
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[6%]" /><col className="w-[30%]" /><col className="w-[34%]" /><col className="w-[15%]" /><col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th></th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Total Visits</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Last Visited</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const personOpen = expandedPeople.has(p.key)
              return (
                <Fragment key={p.key}>
                  <tr onClick={() => togglePerson(p.key)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-2 py-2.5 text-gray-400">
                      <ChevronRightIcon size={14} className={`transition-transform duration-200 ${personOpen ? 'rotate-90' : ''}`} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-900 truncate" title={p.full_name ?? undefined}>{p.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate" title={p.email ?? undefined}>{p.email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{p.total_visits}</td>
                    <td className="px-4 py-2.5 text-gray-700">{formatShortDate(new Date(p.last_visited_at))}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="p-0">
                      <Accordion open={personOpen}>
                        <div className="bg-gray-50 px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th></th>
                                <th className="text-left font-medium pb-1.5 pl-2">Page</th>
                                <th className="text-left font-medium pb-1.5">Visits</th>
                                <th className="text-left font-medium pb-1.5">Last Visited</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.pages
                                .sort((a, b) => b.visit_count - a.visit_count)
                                .map(pg => {
                                  const pageKey = `${p.key}::${pg.path}`
                                  const pageOpen = expandedPages.has(pageKey)
                                  return (
                                    <Fragment key={pageKey}>
                                      <tr onClick={() => togglePage(pageKey)}
                                        className="border-t border-gray-200 hover:bg-gray-100 cursor-pointer">
                                        <td className="py-1.5 pl-1 text-gray-400 w-5">
                                          <ChevronRightIcon size={12} className={`transition-transform duration-200 ${pageOpen ? 'rotate-90' : ''}`} />
                                        </td>
                                        <td className="py-1.5 pl-2 text-gray-800 font-medium">{PATH_LABELS[pg.path] ?? pg.path}</td>
                                        <td className="py-1.5 text-gray-700">{pg.visit_count}</td>
                                        <td className="py-1.5 text-gray-700">{formatShortDate(new Date(pg.last_visited_at))}</td>
                                      </tr>
                                      <tr>
                                        <td colSpan={4} className="p-0">
                                          <Accordion open={pageOpen}>
                                            <div className="bg-white px-2 py-2">
                                              <table className="w-full text-xs">
                                                <thead>
                                                  <tr className="text-gray-400">
                                                    <th className="text-left font-medium pb-1 pl-8">Visited</th>
                                                    <th className="text-left font-medium pb-1">Duration</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {pg.visits
                                                    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                                                    .map(v => (
                                                      <tr key={v.id} className="border-t border-gray-100">
                                                        <td className="py-1 pl-8 text-gray-600">{formatShortDate(new Date(v.started_at))}</td>
                                                        <td className="py-1 text-gray-600">{formatDuration(v.duration_seconds)}</td>
                                                      </tr>
                                                    ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </Accordion>
                                        </td>
                                      </tr>
                                    </Fragment>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </Accordion>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No page visits recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
