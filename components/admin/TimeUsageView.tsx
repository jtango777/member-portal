'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { HourSummary, PersonUsage, Company } from '@/types'
import { formatMonthYear } from '@/lib/utils'
import { AdminTable, Th, Section, Pagination, usePagedList } from '@/components/admin/AdminTable'
import { cn } from '@/lib/utils'

type Props = { summaries: HourSummary[]; people: PersonUsage[]; month: Date }
type ViewMode = 'company' | 'user'
type MemberUsageRow = { company_id: string; default_location_id: string | null }

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 text-sm">
      {(['company', 'user'] as ViewMode[]).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            'px-3 py-1.5 rounded-md font-medium transition-colors',
            view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {v === 'company' ? 'By Company' : 'By User'}
        </button>
      ))}
    </div>
  )
}

// Search + Location filter bar — same layout/pattern as Companies and
// Page Activity, so filtering looks and works the same everywhere.
function FilterBar({ search, onSearch, locationFilter, onLocationFilter, locations, placeholder }: {
  search: string
  onSearch: (v: string) => void
  locationFilter: string
  onLocationFilter: (v: string) => void
  locations: { id: string; name: string }[]
  placeholder: string
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => onSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder={placeholder} />
      </div>
      {locations.length > 0 && (
        <select value={locationFilter} onChange={e => onLocationFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700">
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
    </div>
  )
}

function CompanyTable({ summaries, locations, memberUsage }: {
  summaries: HourSummary[]
  locations: { id: string; name: string }[]
  memberUsage: MemberUsageRow[]
}) {
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')

  // A company's own location_id wins when set; otherwise fall back to
  // wherever its members are based — same two-tier rule as the Companies
  // page's location filter, so a company shows up consistently everywhere
  // regardless of whether it's had a location manually assigned yet.
  const derivedLocationByCompany = new Set(
    locationFilter ? memberUsage.filter(m => m.default_location_id === locationFilter).map(m => m.company_id) : []
  )
  function matchesLocation(c: Company): boolean {
    if (!locationFilter) return true
    if (c.location_id) return c.location_id === locationFilter
    return derivedLocationByCompany.has(c.id)
  }

  const q = search.trim().toLowerCase()
  const filtered = summaries.filter(s =>
    (!q || s.company.name.toLowerCase().includes(q)) && matchesLocation(s.company)
  )
  const { paged, paginationProps } = usePagedList(filtered)

  return (
    <div className="space-y-3">
      <FilterBar search={search} onSearch={setSearch} locationFilter={locationFilter} onLocationFilter={setLocationFilter}
        locations={locations} placeholder="Search companies..." />
      <Section title={`Companies (${filtered.length})`} headerRight={<Pagination {...paginationProps} />}>
        <AdminTable colWidths={['28%', '16%', '16%', '20%', '20%']} minWidth={800}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <Th>Company</Th>
              <Th>Allotment</Th>
              <Th>Used</Th>
              <Th>Remaining</Th>
              <Th>Usage</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No companies match.</td></tr>
            )}
            {paged.map((s, i) => {
              const pct = s.company.monthly_hours_allotment > 0
                ? Math.min(100, (s.hours_used / s.company.monthly_hours_allotment) * 100)
                : 0
              const over = s.hours_used > s.company.monthly_hours_allotment
              return (
                <tr key={s.company.id} className={"border-b border-gray-100 last:border-0 hover:bg-gray-50"}>
                  <td className="px-4 py-2 font-medium text-gray-900 truncate">{s.company.name}</td>
                  <td className="px-4 py-2 text-gray-600">{s.company.monthly_hours_allotment}h</td>
                  <td className="px-4 py-2 text-gray-800">{s.hours_used === 0 ? '0h' : `${s.hours_used.toFixed(1)}h`}</td>
                  <td className={`px-4 py-2 font-semibold ${over ? 'text-red-600' : 'text-green-700'}`}>
                    {over ? '0h' : s.hours_remaining === 0 ? '0h' : `${s.hours_remaining.toFixed(1)}h`}
                    {over && <span className="text-xs font-normal text-red-400 ml-1">(over by {(s.hours_used - s.company.monthly_hours_allotment).toFixed(1)}h)</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 mt-0.5 block">{pct.toFixed(0)}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>
      </Section>
    </div>
  )
}

function UserTable({ people, locations }: { people: PersonUsage[]; locations: { id: string; name: string }[] }) {
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = people.filter(p => {
    if (locationFilter && p.default_location_id !== locationFilter) return false
    return !q || p.name.toLowerCase().includes(q) || (p.company_name ?? '').toLowerCase().includes(q)
  })
  const { paged, paginationProps } = usePagedList(filtered)

  return (
    <div className="space-y-3">
      <FilterBar search={search} onSearch={setSearch} locationFilter={locationFilter} onLocationFilter={setLocationFilter}
        locations={locations} placeholder="Search by name or company..." />
      <Section title={`People (${filtered.length})`} headerRight={<Pagination {...paginationProps} />}>
        <AdminTable colWidths={['30%', '30%', '20%', '20%']} minWidth={700}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <Th>Person</Th>
              <Th>Company</Th>
              <Th>Hours Used</Th>
              <Th>Bookings</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No one matches.</td></tr>
            )}
            {paged.map(p => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900 truncate">{p.name}</td>
                <td className="px-4 py-2 text-gray-600 truncate">{p.company_name ?? <span className="text-gray-400 italic">Individual</span>}</td>
                <td className="px-4 py-2 text-gray-800">{p.hours_used === 0 ? '0h' : `${p.hours_used.toFixed(1)}h`}</td>
                <td className="px-4 py-2 text-gray-600">{p.reservation_count}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </Section>
    </div>
  )
}

export default function TimeUsageView({ summaries, people, month }: Props) {
  const [view, setView] = useState<ViewMode>('company')
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [memberUsage, setMemberUsage] = useState<MemberUsageRow[]>([])

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])

  useEffect(() => {
    // Same source Companies uses to derive a company's location from its
    // members when it doesn't have one explicitly set.
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    fetch(`/api/admin/reports/member-usage?month=${monthStr}`)
      .then(r => r.json())
      .then((rows: { company_id: string; default_location_id: string | null }[]) => setMemberUsage(rows))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Time Usage</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatMonthYear(month)} — hours used vs allotment, by company or by person.</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === 'company'
        ? <CompanyTable summaries={summaries} locations={locations} memberUsage={memberUsage} />
        : <UserTable people={people} locations={locations} />}
    </div>
  )
}
