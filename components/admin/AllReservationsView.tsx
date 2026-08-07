'use client'

import { useState } from 'react'
import { Reservation } from '@/types'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = { reservations: Reservation[] }

export default function AllReservationsView({ reservations: initial }: Props) {
  const [reservations, setReservations] = useState(initial)
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [confirm, setConfirm]           = useState<string | null>(null)
  const [clearingPast, setClearingPast] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

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
  const past     = reservations.filter(r => new Date(r.start_time) < new Date())

  function Table({ rows, showDelete }: { rows: Reservation[]; showDelete: boolean }) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Title</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Room</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Date & Time</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Booked by</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
              {showDelete && <th className="px-4 py-3 w-24" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">None.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                <td className="px-4 py-3 text-gray-600">{r.rooms?.name}</td>
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
                    <div className="grid">
                      <div className={`col-start-1 row-start-1 flex items-center gap-1.5 transition-all duration-150 ${
                        confirm === r.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                      }`}>
                        <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                          {deleting === r.id ? '…' : 'Delete'}
                        </button>
                        <button onClick={() => setConfirm(null)} className="text-xs text-gray-400">No</button>
                      </div>
                      <button onClick={() => setConfirm(r.id)}
                        className={`col-start-1 row-start-1 text-gray-400 hover:text-red-500 transition-all duration-150 w-fit ${
                          confirm === r.id ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
                        }`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
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
        <h1 className="text-xl font-bold text-gray-900">All Reservations</h1>
        <p className="text-sm text-gray-500 mt-0.5">View and manage all upcoming and past bookings.</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-blue-600 mb-2">Upcoming ({upcoming.length})</h2>
        <Table rows={upcoming} showDelete />
      </div>

      {past.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-blue-600">Past ({past.length})</h2>
            <div className="grid justify-end">
              <div className={`col-start-1 row-start-1 flex items-center gap-2 transition-all duration-150 ${
                confirmClear ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}>
                <span className="text-xs text-gray-500 whitespace-nowrap">Delete all {past.length} past reservations?</span>
                <button onClick={handleClearPast} disabled={clearingPast}
                  className="text-xs bg-red-600 text-white px-3 py-1 rounded font-medium disabled:opacity-50">
                  {clearingPast ? 'Clearing…' : 'Yes, clear all'}
                </button>
                <button onClick={() => setConfirmClear(false)} className="text-xs text-gray-400">Cancel</button>
              </div>
              <button onClick={() => setConfirmClear(true)}
                className={`col-start-1 row-start-1 text-xs text-gray-400 hover:text-red-500 transition-all duration-150 whitespace-nowrap ${
                  confirmClear ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
                }`}>
                Clear past bookings
              </button>
            </div>
          </div>
          <Table rows={past} showDelete={false} />
        </div>
      )}
    </div>
  )
}
