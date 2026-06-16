'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Clock, MapPin, User, Phone, Mail, Building2 } from 'lucide-react'
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
    locations: { name: string } | null
  } | null
}

type Filter = 'pending' | 'confirmed' | 'declined' | 'all'

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  declined:  'bg-red-50 text-red-600 border-red-200',
}

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  declined:  'Declined',
}

export default function ExternalBookingsQueue({ bookings: initial }: { bookings: ExternalBooking[] }) {
  const [bookings, setBookings] = useState<ExternalBooking[]>(initial)
  const [filter, setFilter]     = useState<Filter>('pending')
  const [loading, setLoading]   = useState<Record<string, boolean>>({})

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  async function handleAction(id: string, action: 'confirm' | 'decline') {
    setLoading(l => ({ ...l, [id]: true }))
    const res = await fetch(`/api/admin/external-bookings/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: action === 'confirm' ? 'confirmed' : 'declined' } : b))
      toast.success(action === 'confirm' ? 'Booking confirmed' : 'Booking declined')
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Something went wrong')
    }
    setLoading(l => ({ ...l, [id]: false }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">External Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Booking requests from the public /book/ page.
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['pending', 'confirmed', 'declined', 'all'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              filter === f
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No {filter === 'all' ? '' : filter} bookings.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(booking => {
            const room     = booking.rooms
            const roomName = room?.external_name ?? room?.name ?? 'Unknown room'
            const location = room?.locations?.name ?? ''
            const start    = new Date(booking.start_time)
            const end      = new Date(booking.end_time)
            const isLoading = loading[booking.id]

            return (
              <div key={booking.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{booking.external_name}</span>
                      {booking.company_name && (
                        <span className="text-sm text-gray-500">· {booking.company_name}</span>
                      )}
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full border',
                        STATUS_STYLES[booking.status]
                      )}>
                        {STATUS_LABELS[booking.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Received {format(new Date(booking.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={14} className="text-blue-600 flex-shrink-0" />
                    <span>{roomName} · {location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={14} className="text-blue-600 flex-shrink-0" />
                    <span>
                      {format(start, 'EEEE, MMM d, yyyy')} · {formatTime(start)} – {formatTime(end)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={14} className="text-blue-600 flex-shrink-0" />
                    <a href={`mailto:${booking.external_email}`} className="hover:text-blue-600">
                      {booking.external_email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={14} className="text-blue-600 flex-shrink-0" />
                    <a href={`tel:${booking.external_phone.replace(/\D/g,'')}`} className="hover:text-blue-600">
                      {booking.external_phone}
                    </a>
                  </div>
                </div>

                {booking.notes && (
                  <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 italic">
                    "{booking.notes}"
                  </p>
                )}

                {/* Actions */}
                {booking.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <button
                      onClick={() => handleAction(booking.id, 'confirm')}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle size={14} />
                      {isLoading ? 'Saving…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => handleAction(booking.id, 'decline')}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      <XCircle size={14} />
                      {isLoading ? 'Saving…' : 'Decline'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
