'use client'

import { useState, useEffect } from 'react'
import { format, subMonths } from 'date-fns'
import { FileText, Building2, LayoutGrid, ChevronLeft, Download } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReservationRow = {
  id: string; title: string; notes: string | null
  start_time: string; end_time: string
  profiles: { full_name: string } | null
  companies: { name: string } | null
  rooms: { name: string; locations: { name: string } | null } | null
}

type CompanyUsageRow = {
  company_name: string; monthly_allotment: number
  hours_used: number; hours_remaining: number | string
  reservation_count: number
}

type RoomUtilRow = {
  location: string; room: string; capacity: number
  bookings: number; hours_booked: number
  available_hours: number; utilization_pct: number
}

type ReportType = 'reservations' | 'company-usage' | 'room-utilization'

// ── CSV helper ────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines   = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? '')
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ── Month picker ─────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Build last 24 months as options
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = subMonths(now, i)
    options.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') })
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Report cards (landing) ────────────────────────────────────────────────────

const REPORTS = [
  {
    id:          'reservations' as ReportType,
    title:       'Reservations',
    description: 'A line-item report of all reservations for the selected month, including room, time, duration, and who booked.',
    icon:        FileText,
  },
  {
    id:          'company-usage' as ReportType,
    title:       'Company Usage',
    description: 'Hours used by each company for the selected month, with allotments, usage, and remaining time.',
    icon:        Building2,
  },
  {
    id:          'room-utilization' as ReportType,
    title:       'Room Utilization',
    description: 'Booking counts and hours booked per room for the selected month, with utilization percentage against available hours.',
    icon:        LayoutGrid,
  },
]

// ── Individual report views ───────────────────────────────────────────────────

function ReservationsTable({ month }: { month: string }) {
  const [rows, setRows]       = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports/reservations?month=${month}`)
      .then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [month])

  function exportCSV() {
    downloadCSV(`reservations-${month}.csv`, rows.map(r => ({
      Date:     format(new Date(r.start_time), 'MMM d, yyyy'),
      Start:    format(new Date(r.start_time), 'h:mm a'),
      End:      format(new Date(r.end_time),   'h:mm a'),
      Duration: `${((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000).toFixed(1)}h`,
      Title:    r.title,
      Room:     r.rooms?.name ?? '',
      Location: r.rooms?.locations?.name ?? '',
      'Booked By': r.profiles?.full_name ?? '',
      Company:  r.companies?.name ?? '',
      Notes:    r.notes ?? '',
    })))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
  if (!rows.length) return <div className="py-16 text-center text-gray-400 text-sm">No reservations in this month.</div>

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{rows.length} reservation{rows.length !== 1 ? 's' : ''}</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Date', 'Time', 'Duration', 'Title', 'Room', 'Location', 'Booked By', 'Company'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const start = new Date(r.start_time), end = new Date(r.end_time)
              const hrs   = ((end.getTime() - start.getTime()) / 3600000).toFixed(1)
              return (
                <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{format(start, 'MMM d')}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">{format(start, 'h:mm a')}–{format(end, 'h:mm a')}</td>
                  <td className="px-4 py-2.5 text-gray-600">{hrs}h</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.title}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.rooms?.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.rooms?.locations?.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.profiles?.full_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.companies?.name}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CompanyUsageTable({ month }: { month: string }) {
  const [rows, setRows]       = useState<CompanyUsageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports/company-usage?month=${month}`)
      .then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [month])

  function exportCSV() {
    downloadCSV(`company-usage-${month}.csv`, rows.map(r => ({
      Company:            r.company_name,
      'Monthly Allotment': r.monthly_allotment === 9999 ? 'Unlimited' : `${r.monthly_allotment}h`,
      'Hours Used':        `${r.hours_used}h`,
      'Hours Remaining':   typeof r.hours_remaining === 'number' ? `${r.hours_remaining}h` : r.hours_remaining,
      'Reservations':      r.reservation_count,
    })))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>

  const active = rows.filter(r => r.reservation_count > 0)
  const inactive = rows.filter(r => r.reservation_count === 0)

  function Table({ data }: { data: CompanyUsageRow[] }) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Company', 'Allotment', 'Hours Used', 'Remaining', 'Bookings'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const over = typeof r.hours_remaining === 'number' && r.hours_remaining === 0 && r.hours_used > 0
              const unlimited = r.monthly_allotment === 9999
              return (
                <tr key={r.company_name} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.company_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{unlimited ? '∞' : `${r.monthly_allotment}h`}</td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{r.hours_used}h</td>
                  <td className={`px-4 py-2.5 font-medium ${over ? 'text-red-600' : 'text-green-700'}`}>
                    {unlimited ? '∞' : typeof r.hours_remaining === 'number' ? `${r.hours_remaining}h` : r.hours_remaining}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.reservation_count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{active.length} companies with activity, {inactive.length} with none</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <Table data={active} />
      {inactive.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            Show {inactive.length} companies with no activity this month
          </summary>
          <div className="mt-2"><Table data={inactive} /></div>
        </details>
      )}
    </>
  )
}

function RoomUtilTable({ month }: { month: string }) {
  const [rows, setRows]       = useState<RoomUtilRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports/room-utilization?month=${month}`)
      .then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [month])

  function exportCSV() {
    downloadCSV(`room-utilization-${month}.csv`, rows.map(r => ({
      Location:          r.location,
      Room:              r.room,
      Capacity:          r.capacity,
      Bookings:          r.bookings,
      'Hours Booked':    `${r.hours_booked}h`,
      'Available Hours': `${r.available_hours}h`,
      'Utilization %':   `${r.utilization_pct}%`,
    })))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{rows.length} rooms</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Location', 'Room', 'Cap.', 'Bookings', 'Hours Booked', 'Available', 'Utilization'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.location}-${r.room}`} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-2.5 text-gray-600">{r.location}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.room}</td>
                <td className="px-4 py-2.5 text-gray-500">{r.capacity}</td>
                <td className="px-4 py-2.5 text-gray-700">{r.bookings}</td>
                <td className="px-4 py-2.5 text-gray-700">{r.hours_booked}h</td>
                <td className="px-4 py-2.5 text-gray-500">{r.available_hours}h</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.utilization_pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, r.utilization_pct)}%` }} />
                    </div>
                    <span className="text-gray-700 text-xs font-medium">{r.utilization_pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Main hub ──────────────────────────────────────────────────────────────────

export default function ReportsHub() {
  const [active, setActive]   = useState<ReportType | null>(null)
  const [month, setMonth]     = useState(format(new Date(), 'yyyy-MM'))

  const report = REPORTS.find(r => r.id === active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {active && (
          <button onClick={() => setActive(null)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1">
            <ChevronLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {active ? report?.title : 'Reports'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active ? report?.description : 'Exportable reports on reservations, usage, and room activity.'}
          </p>
        </div>
      </div>

      {/* Landing — report cards */}
      {!active && (
        <div className="space-y-3">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActive(r.id)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group">
              <div className="flex items-start gap-4">
                <div className="bg-blue-50 rounded-lg p-2.5 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                  <r.icon size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-blue-600 group-hover:text-blue-700">{r.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active report */}
      {active && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Month</label>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
          {active === 'reservations'     && <ReservationsTable month={month} />}
          {active === 'company-usage'    && <CompanyUsageTable month={month} />}
          {active === 'room-utilization' && <RoomUtilTable month={month} />}
        </>
      )}
    </div>
  )
}
