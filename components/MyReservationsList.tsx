'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, subDays } from 'date-fns'
import Link from 'next/link'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reservation, Room, Profile, Company } from '@/types'
import ReservationModal from '@/components/ReservationModal'
import CancelButton from '@/components/CancelButton'

type Props = {
  upcoming: Reservation[]
  past:     Reservation[]
  companyReservations: any[]
  rooms:    Room[]
  profile:  Profile
  company:  Company | null
  hoursUsed: number
}

export default function MyReservationsList({ upcoming, past, companyReservations, rooms, profile, company, hoursUsed }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [pastRange, setPastRange] = useState<'month' | '30d' | 'all'>('month')

  function handleClose(refresh?: boolean) {
    setEditing(null)
    if (refresh) router.refresh()
  }

  function filterPast(rows: any[]) {
    const now = new Date()
    const pastOnly = rows.filter(r => new Date(r.start_time) < now)
    if (pastRange === 'all') return pastOnly
    const cutoff = pastRange === 'month' ? startOfMonth(now) : subDays(now, 30)
    return pastOnly.filter(r => new Date(r.start_time) >= cutoff)
  }

  function PastRangePills() {
    const options = [
      { key: 'month' as const, label: 'This month' },
      { key: '30d' as const, label: 'Last 30 days' },
      { key: 'all' as const, label: 'All time' },
    ]
    return (
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {options.map(o => (
          <button key={o.key} onClick={() => setPastRange(o.key)}
            className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors',
              pastRange === o.key ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'text-gray-500 hover:text-gray-700'
            )}>
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  function ReservationRow({ r }: { r: any }) {
    const start      = new Date(r.start_time)
    const end        = new Date(r.end_time)
    const hoursUntil = (start.getTime() - Date.now()) / 3600000
    const canEdit    = hoursUntil > 24
    const tooSoon    = hoursUntil > 0 && hoursUntil <= 24

    return (
      <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
        <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
        <td className="px-4 py-3 text-gray-600">{r.rooms?.name}</td>
        <td className="px-4 py-3 text-gray-500 text-xs">{r.rooms?.locations?.name}</td>
        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
          {format(start, 'MMM d, yyyy')}
          <span className="block text-xs text-gray-400">
            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {((end.getTime() - start.getTime()) / 3600000).toFixed(1)}h
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            {canEdit && (
              <button
                onClick={() => setEditing(r)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
            )}
            {canEdit && <CancelButton reservationId={r.id} />}
            {tooSoon && (
              <span
                title="Can't edit or cancel within 24 hours. Contact your admin for help."
                className="text-xs text-gray-400 cursor-help"
              >
                Within 24h ⓘ
              </span>
            )}
          </div>
        </td>
      </tr>
    )
  }

  function Table({ rows }: { rows: any[] }) {
    if (rows.length === 0) return null
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Title', 'Room', 'Location', 'Date & Time', 'Duration', ''].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <ReservationRow key={r.id} r={r} />)}
          </tbody>
        </table>
      </div>
    )
  }

  function TeamTable({ rows }: { rows: any[] }) {
    if (rows.length === 0) return null
    const now = new Date()
    const upcomingTeam = rows.filter(r => new Date(r.start_time) >= now)
    const pastTeam = rows.filter(r => new Date(r.start_time) < now)

    function TeamRow({ r }: { r: any }) {
      const start = new Date(r.start_time)
      const end = new Date(r.end_time)
      return (
        <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
          <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
          <td className="px-4 py-3 text-gray-600">{r.profiles?.full_name ?? 'Unknown'}</td>
          {profile.is_admin && <td className="px-4 py-3 text-gray-500 text-xs">{r.companies?.name ?? ''}</td>}
          <td className="px-4 py-3 text-gray-600">{r.rooms?.name}</td>
          <td className="px-4 py-3 text-gray-500 text-xs">{r.rooms?.locations?.name}</td>
          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
            {format(start, 'MMM d, yyyy')}
            <span className="block text-xs text-gray-400">
              {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
            </span>
          </td>
          <td className="px-4 py-3 text-gray-500 text-xs">
            {((end.getTime() - start.getTime()) / 3600000).toFixed(1)}h
          </td>
        </tr>
      )
    }

    const headers = profile.is_admin
      ? ['Title', 'Booked By', 'Company', 'Room', 'Location', 'Date & Time', 'Duration']
      : ['Title', 'Booked By', 'Room', 'Location', 'Date & Time', 'Duration']

    return (
      <div className="space-y-4">
        {upcomingTeam.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-1.5">Upcoming ({upcomingTeam.length})</h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {headers.map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingTeam.map(r => <TeamRow key={r.id} r={r} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {pastTeam.length > 0 && (() => {
          const filteredPast = filterPast(pastTeam)
          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-400">Past ({filteredPast.length})</h3>
              </div>
              {filteredPast.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {headers.map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPast.map(r => <TeamRow key={r.id} r={r} />)}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-4">No reservations in this period.</p>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Reservations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your upcoming and past bookings.</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Upcoming ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays size={36} className="text-gray-200" />
              <div>
                <p className="text-sm font-medium text-gray-500">No upcoming reservations</p>
                <p className="text-xs text-gray-400 mt-1">
                  <Link href="/dashboard" className="text-blue-600 hover:underline">Make a reservation →</Link>
                </p>
              </div>
            </div>
          ) : (
            <Table rows={upcoming} />
          )}
        </div>

        {past.length > 0 && (() => {
          const filtered = filterPast(past)
          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-500">Past reservations ({filtered.length})</h2>
                <PastRangePills />
              </div>
              {filtered.length > 0 ? <Table rows={filtered} /> : (
                <p className="text-sm text-gray-400 py-4">No reservations in this period.</p>
              )}
            </div>
          )
        })()}

        {companyReservations.length > 0 && (
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {profile.is_admin ? 'All Reservations' : 'Team Reservations'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {profile.is_admin
                ? 'Reservations made by all members across all companies.'
                : `Reservations made by other members of ${company?.name ?? 'your company'}.`}
            </p>
            <TeamTable rows={companyReservations} />
          </div>
        )}
      </div>

      {editing && (
        <ReservationModal
          mode="view"
          reservation={editing}
          selectedDate={new Date(editing.start_time)}
          rooms={rooms}
          profile={profile}
          company={company}
          hoursUsed={hoursUsed}
          onClose={handleClose}
        />
      )}
    </>
  )
}
