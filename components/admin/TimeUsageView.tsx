'use client'

import { HourSummary } from '@/types'
import { formatMonthYear } from '@/lib/utils'

type Props = { summaries: HourSummary[]; month: Date }

export default function TimeUsageView({ summaries, month }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Time Usage</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatMonthYear(month)} — hours used vs allotment per company.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Allotment</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Used</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Remaining</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3 w-48">Usage</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No companies.</td></tr>
            )}
            {summaries.map(s => {
              const pct = s.company.monthly_hours_allotment > 0
                ? Math.min(100, (s.hours_used / s.company.monthly_hours_allotment) * 100)
                : 0
              const over = s.hours_used > s.company.monthly_hours_allotment
              return (
                <tr key={s.company.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.company.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.company.monthly_hours_allotment}h</td>
                  <td className="px-4 py-3 text-gray-800">{s.hours_used.toFixed(1)}h</td>
                  <td className={`px-4 py-3 font-semibold ${over ? 'text-red-600' : 'text-green-700'}`}>
                    {over ? '0h' : `${s.hours_remaining.toFixed(1)}h`}
                    {over && <span className="text-xs font-normal text-red-400 ml-1">(over by {(s.hours_used - s.company.monthly_hours_allotment).toFixed(1)}h)</span>}
                  </td>
                  <td className="px-4 py-3">
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
        </table>
      </div>
    </div>
  )
}
