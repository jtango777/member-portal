'use client'

import { useState, useEffect } from 'react'
import { format, subMonths } from 'date-fns'
import { FileText, Building2, LayoutGrid, ChevronLeft, ChevronRight, Download, Globe, CreditCard, Car, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import type { DayPassChannelReport } from '@/lib/dayPassChannels'

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

type ExternalBookingRow = {
  id: string; external_name: string; external_email: string
  external_phone: string; company_name: string | null
  start_time: string; end_time: string; status: string
  stripe_payment_intent_id: string | null
  rooms: { name: string; external_name: string | null; price_per_hour: number | null; locations: { name: string } | null } | null
}

type DayPassRow = {
  id: string; date: string; price_cents: number; status: string
  confirmation_number: string | null; created_at: string
  day_pass_customers: { first_name: string; last_name: string; email: string } | null
  locations: { name: string } | null
}

type LicensePlateRow = {
  full_name: string | null
  license_plate: string | null
  companies: { name: string } | null
}

type ReportType = 'reservations' | 'company-usage' | 'room-utilization' | 'external-bookings' | 'day-passes' | 'day-pass-channels' | 'license-plates'

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

function MonthPicker({ value, onChange, earliestMonth }: { value: string; onChange: (v: string) => void; earliestMonth: string | null }) {
  // Every month from now back to the earliest reservation on file (not a
  // fixed window) — otherwise this silently drops older months once the
  // data outlives whatever number was hardcoded here.
  const options: { value: string; label: string }[] = []
  const now = new Date()
  const minMonths = earliestMonth
    ? (now.getFullYear() - Number(earliestMonth.slice(0, 4))) * 12 + (now.getMonth() - (Number(earliestMonth.slice(5, 7)) - 1)) + 1
    : 24
  for (let i = 0; i < Math.max(minMonths, 1); i++) {
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
    group:       'Rooms',
    title:       'Reservations',
    description: 'A line-item report of all reservations for the selected month, including room, time, duration, and who booked.',
    icon:        FileText,
  },
  {
    id:          'company-usage' as ReportType,
    group:       'Members and companies',
    title:       'Company Usage',
    description: 'Hours used by each company for the selected month, with allotments, usage, and remaining time.',
    icon:        Building2,
  },
  {
    id:          'room-utilization' as ReportType,
    group:       'Rooms',
    title:       'Room Utilization',
    description: 'Booking counts and hours booked per room for the selected month, with utilization percentage against available hours.',
    icon:        LayoutGrid,
  },
  {
    id:          'external-bookings' as ReportType,
    group:       'Rooms',
    title:       'External Bookings',
    description: 'Revenue and booking details from external (non-member) room reservations, by month and location.',
    icon:        Globe,
  },
  {
    id:          'day-passes' as ReportType,
    group:       'Day passes',
    title:       'Day Passes',
    description: 'Revenue and pass details for the selected month, by location.',
    icon:        CreditCard,
  },
  {
    id:          'day-pass-channels' as ReportType,
    group:       'Day passes',
    title:       'Day Pass Demand and Channels',
    description: 'Month by month: total day pass sales from QuickBooks, how much of that came from the self-serve website, and how much was sold at the front desk.',
    icon:        TrendingUp,
  },
  {
    id:          'license-plates' as ReportType,
    group:       'Members and companies',
    title:       'License Plates',
    description: 'Every active member and the license plate on file for them. A current snapshot, not tied to a specific month.',
    icon:        Car,
  },
]

const REPORT_GROUPS = ['Rooms', 'Day passes', 'Members and companies'] as const

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
                <tr key={r.id} className={'border-b border-gray-100 last:border-0'}>
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
  const [showInactive, setShowInactive] = useState(false)

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
              {['Company', 'Usage', 'Remaining', 'Bookings'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const over = typeof r.hours_remaining === 'number' && r.hours_remaining === 0 && r.hours_used > 0
              const unlimited = r.monthly_allotment === 9999
              const pct = unlimited || r.monthly_allotment <= 0 ? 0 : Math.min(100, (r.hours_used / r.monthly_allotment) * 100)
              return (
                <tr key={r.company_name} className={'border-b border-gray-100 last:border-0'}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.company_name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-800 font-medium">
                      {r.hours_used}h {unlimited ? '' : `of ${r.monthly_allotment}h`}
                    </span>
                    {!unlimited && (
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </td>
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
        <div className="mt-4">
          <button onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 select-none">
            <ChevronRight size={14} className={`transition-transform duration-200 ${showInactive ? 'rotate-90' : ''}`} />
            {showInactive ? 'Hide' : 'Show'} {inactive.length} companies with no activity this month
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showInactive ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="mt-2"><Table data={inactive} /></div>
            </div>
          </div>
        </div>
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
              <tr key={`${r.location}-${r.room}`} className={'border-b border-gray-100 last:border-0'}>
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

function ExternalBookingsTable({ month }: { month: string }) {
  const [rows, setRows]       = useState<ExternalBookingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports/external-bookings?month=${month}`)
      .then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [month])

  const confirmed = rows.filter(r => r.status === 'confirmed')

  const totalRevenue = confirmed.reduce((sum, r) => {
    const hours = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000
    const rate = r.rooms?.price_per_hour ?? 0
    return sum + (hours * rate)
  }, 0)

  const byLocation: Record<string, { count: number; revenue: number }> = {}
  confirmed.forEach(r => {
    const loc = r.rooms?.locations?.name ?? 'Unknown'
    if (!byLocation[loc]) byLocation[loc] = { count: 0, revenue: 0 }
    byLocation[loc].count++
    const hours = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000
    byLocation[loc].revenue += hours * (r.rooms?.price_per_hour ?? 0)
  })

  function exportCSV() {
    downloadCSV(`external-bookings-${month}.csv`, rows.map(r => {
      const hours = ((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000)
      const amount = hours * (r.rooms?.price_per_hour ?? 0)
      return {
        Date:      format(new Date(r.start_time), 'MMM d, yyyy'),
        Start:     format(new Date(r.start_time), 'h:mm a'),
        End:       format(new Date(r.end_time),   'h:mm a'),
        Hours:     hours.toFixed(1),
        Guest:     r.external_name,
        Email:     r.external_email,
        Phone:     r.external_phone,
        Company:   r.company_name ?? '',
        Room:      r.rooms?.external_name ?? r.rooms?.name ?? '',
        Location:  r.rooms?.locations?.name ?? '',
        Rate:      `$${r.rooms?.price_per_hour ?? 0}/hr`,
        Amount:    `$${amount.toFixed(2)}`,
        Status:    r.status,
      }
    }))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
  if (!rows.length) return <div className="py-16 text-center text-gray-400 text-sm">No external bookings in this month.</div>

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">Total bookings</p>
          <p className="text-xl font-medium text-gray-900 mt-1">{confirmed.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">Total revenue</p>
          <p className="text-xl font-medium text-gray-900 mt-1">${totalRevenue.toFixed(2)}</p>
        </div>
        {Object.entries(byLocation).map(([loc, data]) => (
          <div key={loc} className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">{loc}</p>
            <p className="text-xl font-medium text-gray-900 mt-1">${data.revenue.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{data.count} booking{data.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{rows.length} booking{rows.length !== 1 ? 's' : ''}</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Date', 'Time', 'Guest', 'Room', 'Location', 'Amount', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const start = new Date(r.start_time), end = new Date(r.end_time)
              const hours = (end.getTime() - start.getTime()) / 3600000
              const amount = hours * (r.rooms?.price_per_hour ?? 0)
              return (
                <tr key={r.id} className={'border-b border-gray-100 last:border-0'}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{format(start, 'MMM d')}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">{format(start, 'h:mm a')}–{format(end, 'h:mm a')}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.external_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.rooms?.external_name ?? r.rooms?.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.rooms?.locations?.name}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-medium">${amount.toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                      r.status === 'declined'  ? 'bg-red-50 text-red-700' :
                                                  'bg-yellow-50 text-yellow-700'
                    }`}>{r.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function DayPassesTable({ month }: { month: string }) {
  const [rows, setRows]       = useState<DayPassRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports/day-passes?month=${month}`)
      .then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [month])

  const confirmed = rows.filter(r => r.status === 'confirmed')
  const totalRevenue = confirmed.reduce((sum, r) => sum + r.price_cents / 100, 0)

  const byLocation: Record<string, { count: number; revenue: number }> = {}
  confirmed.forEach(r => {
    const loc = r.locations?.name ?? 'Unknown'
    if (!byLocation[loc]) byLocation[loc] = { count: 0, revenue: 0 }
    byLocation[loc].count++
    byLocation[loc].revenue += r.price_cents / 100
  })

  function exportCSV() {
    downloadCSV(`day-passes-${month}.csv`, rows.map(r => ({
      Date:          format(new Date(r.date + 'T12:00:00'), 'MMM d, yyyy'),
      Guest:         r.day_pass_customers ? `${r.day_pass_customers.first_name} ${r.day_pass_customers.last_name}` : '',
      Email:         r.day_pass_customers?.email ?? '',
      Location:      r.locations?.name ?? '',
      Amount:        `$${(r.price_cents / 100).toFixed(2)}`,
      Status:        r.status,
      Confirmation:  r.confirmation_number ?? '',
    })))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
  if (!rows.length) return <div className="py-16 text-center text-gray-400 text-sm">No day passes in this month.</div>

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">Total passes</p>
          <p className="text-xl font-medium text-gray-900 mt-1">{confirmed.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">Total revenue</p>
          <p className="text-xl font-medium text-gray-900 mt-1">${totalRevenue.toFixed(2)}</p>
        </div>
        {Object.entries(byLocation).map(([loc, data]) => (
          <div key={loc} className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">{loc}</p>
            <p className="text-xl font-medium text-gray-900 mt-1">${data.revenue.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{data.count} pass{data.count !== 1 ? 'es' : ''}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{rows.length} pass{rows.length !== 1 ? 'es' : ''}</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Date', 'Guest', 'Location', 'Amount', 'Status', 'Confirmation'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={'border-b border-gray-100 last:border-0'}>
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{format(new Date(r.date + 'T12:00:00'), 'MMM d')}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {r.day_pass_customers ? `${r.day_pass_customers.first_name} ${r.day_pass_customers.last_name}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{r.locations?.name}</td>
                <td className="px-4 py-2.5 text-gray-700 font-medium">${(r.price_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                    r.status === 'declined'  ? 'bg-red-50 text-red-700' :
                                                'bg-yellow-50 text-yellow-700'
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{r.confirmation_number ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// Day pass demand and channel mix.
//
// Written for one reader answering two questions: is day pass demand
// growing, and is the new self-serve site taking any of it. The columns are
// in that order for that reason, and the note at the bottom says where each
// number comes from, because the honest answer is that they come from two
// different systems and only one of them sees every sale.
function DayPassChannelsReport() {
  const [data, setData]       = useState<DayPassChannelReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed]   = useState(false)

  // Runs once, and `loading` already starts true, so there is nothing to
  // set on the way in. The other reports here re-fetch when the month
  // changes and have to; this one always covers the same trailing months.
  useEffect(() => {
    fetch('/api/admin/reports/day-pass-channels')
      .then(r => r.json())
      .then(d => {
        // An error response, or a month list this component cannot read a
        // "latest month" out of, is a failure rather than something to
        // render half of.
        if (Array.isArray(d?.months) && d.months.length > 0) setData(d as DayPassChannelReport)
        else setFailed(true)
        setLoading(false)
      })
      .catch(() => { setFailed(true); setLoading(false) })
  }, [])

  function exportCSV() {
    if (!data) return
    downloadCSV('day-pass-demand-and-channels.csv', data.months.map(m => ({
      Month:                  m.label,
      'Total Revenue':        formatMoney(m.totalRevenue),
      'Total Passes (approx)': m.totalCount,
      'Self-Serve Revenue':   formatMoney(m.selfServeRevenue),
      'Self-Serve Passes':    m.selfServeCount,
      'Front Desk Revenue':   formatMoney(m.deskRevenue),
      'Front Desk Passes (approx)': m.deskCount,
      'Self-Serve Share':     m.selfServePct === null ? '' : `${m.selfServePct}%`,
    })))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Reading QuickBooks…</div>
  if (failed || !data) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        Could not load this report. QuickBooks may be unreachable right now. Try again in a minute.
      </div>
    )
  }

  const months   = data.months
  // The last month is the one running right now, so it is only part of a
  // month and must not be compared with a full one.
  const current  = months[months.length - 1]
  const complete = months.slice(0, -1)
  const lastFull = complete[complete.length - 1]
  const baseline = data.baseline

  const vsBaseline = lastFull && baseline.revenuePerMonth > 0
    ? Math.round(((lastFull.totalRevenue - baseline.revenuePerMonth) / baseline.revenuePerMonth) * 100)
    : null

  const maxRevenue = Math.max(...months.map(m => m.totalRevenue), baseline.revenuePerMonth, 1)
  const anyMismatch = months.some(m => !m.reconciles)

  return (
    <>
      {/* The two questions, answered before any table. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Is demand growing?</p>
          {lastFull ? (
            <>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {formatMoney(lastFull.totalRevenue)}
                <span className="text-sm font-normal text-gray-500"> in {lastFull.label}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {vsBaseline === null ? 'No baseline to compare with.' : (
                  <>
                    <span className={vsBaseline >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                      {vsBaseline >= 0 ? '+' : ''}{vsBaseline}%
                    </span>{' '}
                    against the {formatMoney(baseline.revenuePerMonth)} a month the business was doing before the site launched.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No complete month yet.</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Is the self-serve site working?</p>
          {lastFull ? (
            <>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {lastFull.selfServePct === null ? 'No sales' : `${lastFull.selfServePct}%`}
                <span className="text-sm font-normal text-gray-500"> of {lastFull.label} sales</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {formatMoney(lastFull.selfServeRevenue)} booked on the website, {formatMoney(lastFull.deskRevenue)} sold at the desk.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No complete month yet.</p>
          )}
        </div>
      </div>

      {/* Anything missing from QuickBooks makes the total too low and the
          self-serve share too high, so it is said plainly rather than left
          for someone to work out from a number that looks fine. */}
      {data.issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Some sales are missing from these totals</p>
              <ul className="mt-1.5 space-y-1">
                {data.issues.map((i, n) => (
                  <li key={n} className="text-sm text-amber-800"><span className="font-medium">{i.location}:</span> {i.message}</li>
                ))}
              </ul>
              <p className="text-sm text-amber-800 mt-2">
                Until that is fixed, the totals below are too low and the self-serve share is too high.
              </p>
            </div>
          </div>
        </div>
      )}

      {anyMismatch && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">One or more months do not add up</p>
              <p className="text-sm text-amber-800 mt-1">
                Website sales came out higher than the QuickBooks total for a month marked below, which should be
                impossible. It usually means a website sale did not reach QuickBooks. Worth asking about before
                quoting these figures.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">Last {months.length} months. Self-serve site launched {data.launchMonthLabel}.</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Month', 'Total (all sales)', 'Website', 'Front desk', 'Website share'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map(m => {
              const isCurrent = m.month === current.month
              return (
                <tr key={m.month} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{m.label}</span>
                    {isCurrent && <span className="block text-xs text-gray-400">so far this month</span>}
                    {!m.reconciles && <span className="block text-xs text-amber-700">does not add up</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{formatMoney(m.totalRevenue)}</span>
                    <span className="block text-xs text-gray-400">about {m.totalCount} pass{m.totalCount !== 1 ? 'es' : ''}</span>
                    <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                      <div className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(m.totalRevenue / maxRevenue) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-gray-800">{formatMoney(m.selfServeRevenue)}</span>
                    <span className="block text-xs text-gray-400">{m.selfServeCount} pass{m.selfServeCount !== 1 ? 'es' : ''}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-gray-800">{formatMoney(m.deskRevenue)}</span>
                    <span className="block text-xs text-gray-400">about {m.deskCount} pass{m.deskCount !== 1 ? 'es' : ''}</span>
                  </td>
                  <td className="px-4 py-3">
                    {m.selfServePct === null ? (
                      <span className="text-gray-300">no sales</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, m.selfServePct)}%` }} />
                        </div>
                        <span className="text-gray-700 text-xs font-medium">{m.selfServePct}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            {/* The pre-launch baseline, in the same column as the total it
                should be compared against, so nobody lines it up against
                the website column by mistake. */}
            <tr className="bg-gray-50 border-t border-gray-200">
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-medium text-gray-700">Before launch</span>
                <span className="block text-xs text-gray-400">{baseline.label}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-medium text-gray-700">{formatMoney(baseline.revenuePerMonth)}/mo</span>
                <span className="block text-xs text-gray-400">about {baseline.passesPerMonth} passes</span>
                <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full rounded-full bg-gray-400"
                    style={{ width: `${(baseline.revenuePerMonth / maxRevenue) * 100}%` }} />
                </div>
              </td>
              <td className="px-4 py-3 text-gray-400">none</td>
              <td className="px-4 py-3 text-gray-400">all of it</td>
              <td className="px-4 py-3 text-gray-400">0%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm text-gray-600">
        <p className="font-semibold text-gray-800">Where these numbers come from</p>
        <p>
          <span className="font-medium text-gray-800">Total</span> comes from QuickBooks, summed across El Segundo,
          Marina del Rey and Costa Mesa. QuickBooks is the only place that sees every day pass, because a pass sold
          at the front desk is rung up there and nowhere else.
        </p>
        <p>
          <span className="font-medium text-gray-800">Website</span> comes from this app&apos;s own records, counting
          confirmed passes only. <span className="font-medium text-gray-800">Front desk</span> is the total minus the
          website, because desk sales leave no trace in this app.
        </p>
        <p>
          Dollar figures are reliable. Pass counts are marked &quot;about&quot; because QuickBooks mixes multi-day and
          discounted sales onto single lines, so its quantities cannot be trusted the way the money can. Judge growth
          on revenue.
        </p>
        <p>
          Months are grouped by the date of sale, not the date of the visit, which is how QuickBooks records it. A
          cancelled and refunded pass drops out of both columns.
        </p>
      </div>
    </>
  )
}

function LicensePlatesTable() {
  const [rows, setRows]       = useState<LicensePlateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/reports/license-plates')
      .then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [])

  function exportCSV() {
    downloadCSV('license-plates.csv', rows.map(r => ({
      Name:           r.full_name ?? '',
      Company:        r.companies?.name ?? '',
      'License Plate': r.license_plate ?? '',
    })))
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
  if (!rows.length) return <div className="py-16 text-center text-gray-400 text-sm">No active members yet.</div>

  const withPlate = rows.filter(r => r.license_plate)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{withPlate.length} of {rows.length} members have a plate on file</p>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Name', 'Company', 'License Plate'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.full_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.companies?.name ?? ''}</td>
                <td className={`px-4 py-2.5 font-mono ${r.license_plate ? 'text-gray-900' : 'text-gray-300'}`}>
                  {r.license_plate ?? 'None on file'}
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

export default function ReportsHub({ earliestMonth }: { earliestMonth: string | null }) {
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
          {REPORT_GROUPS.map(groupName => (
            <div key={groupName} className="flex flex-col gap-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{groupName}</div>
              {REPORTS.filter(r => r.group === groupName).map(r => (
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
          ))}
        </div>
      )}

      {/* Active report */}
      {active && (
        <>
          {/* License Plates isn't month-scoped — it's a current snapshot,
              not a time series, so the month picker doesn't apply to it.
              Day Pass Demand and Channels is the opposite case: it's a
              fixed trailing run of months, so picking one month would
              defeat the point. */}
          {active !== 'license-plates' && active !== 'day-pass-channels' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Month</label>
              <MonthPicker value={month} onChange={setMonth} earliestMonth={earliestMonth} />
            </div>
          )}
          {active === 'reservations'      && <ReservationsTable month={month} />}
          {active === 'company-usage'     && <CompanyUsageTable month={month} />}
          {active === 'room-utilization'  && <RoomUtilTable month={month} />}
          {active === 'external-bookings' && <ExternalBookingsTable month={month} />}
          {active === 'day-passes'        && <DayPassesTable month={month} />}
          {active === 'day-pass-channels' && <DayPassChannelsReport />}
          {active === 'license-plates'    && <LicensePlatesTable />}
        </>
      )}
    </div>
  )
}
