'use client'

import { HourSummary } from '@/types'
import { formatMonthYear } from '@/lib/utils'
import { AdminTable, Th, Section, Pagination, usePagedList } from '@/components/admin/AdminTable'

type Props = { summaries: HourSummary[]; month: Date }

export default function TimeUsageView({ summaries, month }: Props) {
  const { paged, paginationProps } = usePagedList(summaries)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Time Usage</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatMonthYear(month)} — hours used vs allotment per company.</p>
      </div>

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
    </div>
  )
}
