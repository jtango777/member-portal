'use client'

import { useState } from 'react'
import { Reservation } from '@/types'
import { format } from 'date-fns'
import { Trash2, MapPin, Clock, Mail, Phone } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'

type ExternalBooking = {
  id: string
  external_name: string
  external_email: string
  external_phone: string
  company_name: string | null
  notes: string | null
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'declined'
  created_at: string
  rooms: {
    external_name: string | null
    name: string
    price_per_hour: number | null
    locations: { name: string } | null
  } | null
}

type Tab = 'internal' | 'external' | 'all'
type ExternalFilter = 'confirmed' | 'all'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  declined:  'bg-red-50 text-red-600 border-red-200',
}

type Props = {
  reservations: Reservation[]
  externalBookings: ExternalBooking[]
}

export default function AllBookingsView({ reservations: initialRes, externalBookings }: Props) {
  const [reservations, setReservations] = useState(initialRes)
  const [activeTab, setActiveTab] = useState<Tab>('internal')
  const [extFilter, setExtFilter] = useState<ExternalFilter>('confirmed')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [clearingPast, setClearingPast] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // --- Delete handlers (internal only) ---
  async function handleDelete(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Reservation deleted')
      setReservations(prev => prev.filter(r => r.id !== id))
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to delete')
    }
    setDeleting(null)
    setConfirm(null)
  }

  async function handleClearPast() {
    setClearingPast(true)
    const pastIds = reservations.filter(r => new Date(r.start_time) < new Date()).map(r => r.id)
    let failed = 0
    for (const id of pastIds) {
      const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
      if (!res.ok) failed++
    }
    setReservations(prev => prev.filter(r => new Date(r.start_time) >= new Date()))
    setClearingPast(false)
    setConfirmClear(false)
    if (failed > 0) toast.error(`${failed} reservation(s) could not be deleted`)
    else toast.success('Past reservations cleared')
  }

  const upcoming = reservations.filter(r => new Date(r.start_time) >= new Date())
  const past = reservations.filter(r => new Date(r.start_time) < new Date())
  const filteredExternal = extFilter === 'all'
    ? externalBookings
    : externalBookings.filter(b => b.status === extFilter)
  const confirmedCount = externalBookings.filter(b => b.status === 'confirmed').length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'internal', label: 'Internal', count: reservations.length },
    { key: 'external', label: 'External', count: externalBookings.length },
    { key: 'all', label: 'All', count: reservations.length + externalBookings.length },
  ]

  // --- Internal table ---
  function InternalTable({ rows, showDelete }: { rows: Reservation[]; showDelete: boolean }) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Title</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Room</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Location</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Date & Time</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Booked by</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
              {showDelete && <th className="px-4 py-3 w-24" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">None.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                <td className="px-4 py-3 text-gray-600">{r.rooms?.name}</td>
                <td className="px-4 py-3 text-gray-600">{(r.rooms as any)?.locations?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {format(new Date(r.start_time), 'MMM d, yyyy')}<br />
                  <span className="text-xs text-gray-400">
                    {format(new Date(r.start_time), 'h:mm a')} – {format(new Date(r.end_time), 'h:mm a')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.profiles?.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{r.companies?.name}</td>
                {showDelete && (
                  <td className="px-4 py-3 w-24">
                    {confirm === r.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                          {deleting === r.id ? '...' : 'Delete'}
                        </button>
                        <button onClick={() => setConfirm(null)} className="text-xs text-gray-400">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirm(r.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // --- External card ---
  function ExternalCard({ booking }: { booking: ExternalBooking }) {
    const room = booking.rooms
    const roomName = room?.external_name ?? room?.name ?? 'Unknown room'
    const location = room?.locations?.name ?? ''
    const start = new Date(booking.start_time)
    const end = new Date(booking.end_time)
    const hours = (end.getTime() - start.getTime()) / 3_600_000
    const amount = hours * (room?.price_per_hour ?? 0)

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{booking.external_name}</span>
              {booking.company_name && (
                <span className="text-sm text-gray-500">· {booking.company_name}</span>
              )}
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full border',
                STATUS_STYLES[booking.status] ?? ''
              )}>
                {booking.status}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {format(new Date(booking.created_at), 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
          <span className="text-lg font-bold text-gray-900 flex-shrink-0">
            ${amount.toFixed(0)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={14} className="text-blue-600 flex-shrink-0" />
            <span>{roomName} · {location}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={14} className="text-blue-600 flex-shrink-0" />
            <span>
              {format(start, 'EEE, MMM d')} · {formatTime(start)} – {formatTime(end)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Mail size={14} className="text-gray-400 flex-shrink-0" />
            <a href={`mailto:${booking.external_email}`} className="hover:text-blue-600">
              {booking.external_email}
            </a>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Phone size={14} className="text-gray-400 flex-shrink-0" />
            <a href={`tel:${booking.external_phone.replace(/\D/g, '')}`} className="hover:text-blue-600">
              {booking.external_phone}
            </a>
          </div>
        </div>

        {booking.notes && (
          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 italic">
            &ldquo;{booking.notes}&rdquo;
          </p>
        )}
      </div>
    )
  }

  // --- Combined "All" table ---
  function CombinedTable() {
    type CombinedRow = {
      id: string
      type: 'Internal' | 'External'
      title: string
      room: string
      location: string
      dateTime: Date
      endTime: Date
      bookedBy: string
      company: string
    }

    const internalRows: CombinedRow[] = reservations.map(r => ({
      id: r.id,
      type: 'Internal',
      title: r.title,
      room: r.rooms?.name ?? '',
      location: (r.rooms as any)?.locations?.name ?? '—',
      dateTime: new Date(r.start_time),
      endTime: new Date(r.end_time),
      bookedBy: r.profiles?.full_name ?? '',
      company: r.companies?.name ?? '',
    }))

    const externalRows: CombinedRow[] = externalBookings.map(b => ({
      id: b.id,
      type: 'External',
      title: b.rooms?.external_name ?? b.rooms?.name ?? 'External booking',
      room: b.rooms?.external_name ?? b.rooms?.name ?? '',
      location: b.rooms?.locations?.name ?? '—',
      dateTime: new Date(b.start_time),
      endTime: new Date(b.end_time),
      bookedBy: b.external_name,
      company: b.company_name ?? '',
    }))

    const combined = [...internalRows, ...externalRows].sort(
      (a, b) => a.dateTime.getTime() - b.dateTime.getTime()
    )

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Type</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Title / Name</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Room</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Location</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Date & Time</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Booked by</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
            </tr>
          </thead>
          <tbody>
            {combined.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No bookings.</td></tr>
            )}
            {combined.map(row => (
              <tr key={`${row.type}-${row.id}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full border',
                    row.type === 'Internal'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  )}>
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                <td className="px-4 py-3 text-gray-600">{row.room}</td>
                <td className="px-4 py-3 text-gray-600">{row.location}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {format(row.dateTime, 'MMM d, yyyy')}<br />
                  <span className="text-xs text-gray-400">
                    {format(row.dateTime, 'h:mm a')} – {format(row.endTime, 'h:mm a')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.bookedBy}</td>
                <td className="px-4 py-3 text-gray-600">{row.company}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">All Bookings</h1>
        <p className="text-sm text-gray-500 mt-0.5">View and manage all internal and external bookings.</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Internal tab */}
      {activeTab === 'internal' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-blue-600 mb-2">Upcoming ({upcoming.length})</h2>
            <InternalTable rows={upcoming} showDelete />
          </div>

          {past.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-blue-600">Past ({past.length})</h2>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Delete all {past.length} past reservations?</span>
                    <button onClick={handleClearPast} disabled={clearingPast}
                      className="text-xs bg-red-600 text-white px-3 py-1 rounded font-medium disabled:opacity-50">
                      {clearingPast ? 'Clearing...' : 'Yes, clear all'}
                    </button>
                    <button onClick={() => setConfirmClear(false)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmClear(true)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Clear past bookings
                  </button>
                )}
              </div>
              <InternalTable rows={past} showDelete={false} />
            </div>
          )}
        </div>
      )}

      {/* External tab */}
      {activeTab === 'external' && (
        <div className="space-y-4">
          {externalBookings.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No bookings yet.</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Guest', 'Email', 'Phone', 'Room', 'Location', 'Date & Time', 'Amount', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {externalBookings.map((b, i) => {
                    const start = new Date(b.start_time)
                    const end = new Date(b.end_time)
                    const hours = (end.getTime() - start.getTime()) / 3_600_000
                    const amount = hours * (b.rooms?.price_per_hour ?? 0)
                    return (
                      <tr key={b.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {b.external_name}
                          {b.company_name && <span className="text-gray-400 font-normal"> · {b.company_name}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.external_email}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.external_phone}</td>
                        <td className="px-4 py-3 text-gray-600">{b.rooms?.external_name ?? b.rooms?.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{b.rooms?.locations?.name}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {format(start, 'MMM d, yyyy')}
                          <span className="block text-xs text-gray-400">{formatTime(start)} – {formatTime(end)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">${amount.toFixed(0)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', STATUS_STYLES[b.status] ?? '')}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All tab */}
      {activeTab === 'all' && <CombinedTable />}
    </div>
  )
}
