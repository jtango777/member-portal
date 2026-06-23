'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { MapPin, Clock, Mail, Phone, Building2 } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'

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

type Filter = 'confirmed' | 'all'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  declined:  'bg-red-50 text-red-600 border-red-200',
}

export default function ExternalBookingsQueue({ bookings: initial }: { bookings: ExternalBooking[] }) {
  const [filter, setFilter] = useState<Filter>('confirmed')

  const confirmedCount = initial.filter(b => b.status === 'confirmed').length
  const filtered = filter === 'all' ? initial : initial.filter(b => b.status === filter)

  const totalRevenue = initial
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => {
      const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3_600_000
      return sum + hours * (b.rooms?.price_per_hour ?? 0)
    }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">External Bookings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All bookings from the public booking site. Payment auto-confirms.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Confirmed Bookings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{confirmedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{initial.length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['confirmed', 'all'] as Filter[]).map(f => (
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
            {f === 'all' ? `All (${initial.length})` : `Confirmed (${confirmedCount})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No bookings yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(booking => {
            const room     = booking.rooms
            const roomName = room?.external_name ?? room?.name ?? 'Unknown room'
            const location = room?.locations?.name ?? ''
            const start    = new Date(booking.start_time)
            const end      = new Date(booking.end_time)
            const hours    = (end.getTime() - start.getTime()) / 3_600_000
            const amount   = hours * (room?.price_per_hour ?? 0)

            return (
              <div key={booking.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
