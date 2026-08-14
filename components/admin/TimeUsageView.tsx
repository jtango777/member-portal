'use client'

import { useState } from 'react'
import { HourSummary, PersonUsage } from '@/types'
import { formatMonthYear } from '@/lib/utils'
import { AdminTable, Th, Section, Pagination, usePagedList } from '@/components/admin/AdminTable'
import { cn } from '@/lib/utils'

type Props = { summaries: HourSummary[]; people: PersonUsage[]; month: Date }
type ViewMode = 'company' | 'user'

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

function CompanyTable({ summaries }: { summaries: HourSummary[] }) {
  const { paged, paginationProps } = usePagedList(summaries)

  return (
    <Section title={`Companies (${summaries.length})`} headerRight={<Pagination {...paginationProps} />}>
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
          {summaries.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No companies.</td></tr>
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
  )
}

function UserTable({ people }: { people: PersonUsage[] }) {
  const { paged, paginationProps } = usePagedList(people)

  return (
    <Section title={`People (${people.length})`} headerRight={<Pagination {...paginationProps} />}>
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
          {people.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No one to show.</td></tr>
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
  )
}

export default function TimeUsageView({ summaries, people, month }: Props) {
  const [view, setView] = useState<ViewMode>('company')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Time Usage</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatMonthYear(month)} — hours used vs allotment, by company or by person.</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === 'company' ? <CompanyTable summaries={summaries} /> : <UserTable people={people} />}
    </div>
  )
}
