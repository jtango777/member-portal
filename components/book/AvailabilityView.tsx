'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import MiniDatePicker from '@/components/MiniDatePicker'

type BookRoom = {
  id: string
  external_name: string
  capacity: number
  price_per_hour: number
}

type BookLocation = {
  id: string
  name: string
  slug: string
}

const HEADCOUNT_OPTIONS = [
  { label: '1–4 people', value: '1-4' },
  { label: '5–8 people', value: '5-8' },
  { label: '9+ people',  value: '9+'  },
]

// 30-min slots 7:00 AM – 9:30 PM
const SLOTS: { value: string; label: string }[] = []
for (let h = 7; h < 22; h++) {
  for (const m of [0, 30]) {
    SLOTS.push({
      value: `${h}:${m.toString().padStart(2, '0')}`,
      label: format(new Date(2000, 0, 1, h, m), 'h:mm a'),
    })
  }
}

function filterRooms(rooms: BookRoom[], headcount: string): BookRoom[] {
  if (headcount === '1-4') return rooms.filter(r => r.capacity <= 8)
  if (headcount === '5-8') return rooms.filter(r => r.capacity >= 5)
  if (headcount === '9+')  return rooms.filter(r => r.capacity >= 9)
  return rooms
}

export default function AvailabilityView({ location, rooms }: { location: BookLocation; rooms: BookRoom[] }) {
  const today = format(new Date(), 'yyyy-MM-dd')

  const [headcount,    setHeadcount]    = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<BookRoom | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [blockedSlots, setBlockedSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const filteredRooms = headcount ? filterRooms(rooms, headcount) : []

  // Reset room selection if it's no longer valid after headcount change
  useEffect(() => {
    if (selectedRoom && !filteredRooms.find(r => r.id === selectedRoom.id)) {
      setSelectedRoom(null)
      setBlockedSlots([])
      setSelectedSlot(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headcount])

  // Fetch availability when room or date changes
  useEffect(() => {
    if (!selectedRoom) return
    setLoadingSlots(true)
    setSelectedSlot(null)
    fetch(`/api/book/availability?roomId=${selectedRoom.id}&date=${selectedDate}`)
      .then(r => r.json())
      .then(data => { setBlockedSlots(data.blockedSlots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [selectedRoom, selectedDate])

  function prevDay() {
    const prev = format(subDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd')
    if (prev >= today) setSelectedDate(prev)
  }
  function nextDay() {
    setSelectedDate(format(addDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd'))
  }

  const selectedSlotLabel = SLOTS.find(s => s.value === selectedSlot)?.label

  return (
    <div className="space-y-10">
      {/* Back */}
      <Link href="/book" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} />
        All locations
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{location.name}</h1>
        <p className="text-gray-500 mt-1">Check availability and book a meeting room</p>
      </div>

      {/* Step 1 — Headcount */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Step 1 · How many people?
        </p>
        <div className="flex flex-wrap gap-2">
          {HEADCOUNT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setHeadcount(opt.value); setSelectedRoom(null); setSelectedSlot(null) }}
              className={cn(
                'px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                headcount === opt.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Room */}
      {headcount && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Step 2 · Select a room
          </p>
          {filteredRooms.length === 0 ? (
            <p className="text-sm text-gray-500">No rooms available for this group size at {location.name}.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => { setSelectedRoom(room); setSelectedSlot(null) }}
                  className={cn(
                    'text-left border rounded-xl px-5 py-4 transition-colors',
                    selectedRoom?.id === room.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  )}
                >
                  <div className="font-semibold text-base">{room.external_name}</div>
                  <div className={cn('text-sm mt-1', selectedRoom?.id === room.id ? 'text-gray-300' : 'text-gray-500')}>
                    Up to {room.capacity} people · ${room.price_per_hour}/hr
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Date */}
      {selectedRoom && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Step 3 · Pick a date
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={prevDay}
              disabled={selectedDate <= today}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-48">
              <MiniDatePicker value={selectedDate} onChange={v => { setSelectedDate(v); setSelectedSlot(null) }} />
            </div>
            <button onClick={nextDay} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Time slots */}
      {selectedRoom && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Step 4 · Select a start time
          </p>

          {loadingSlots ? (
            <p className="text-sm text-gray-400">Loading availability…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {SLOTS.map(slot => {
                  const isBlocked  = blockedSlots.includes(slot.value)
                  const isSelected = selectedSlot === slot.value
                  return (
                    <button
                      key={slot.value}
                      disabled={isBlocked}
                      onClick={() => setSelectedSlot(isSelected ? null : slot.value)}
                      className={cn(
                        'py-2 px-1 rounded-lg text-sm font-medium border transition-colors text-center',
                        isBlocked
                          ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                          : isSelected
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      )}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-3 mt-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-gray-100 border border-gray-100 inline-block" />
                  Unavailable
                </span>
              </div>
            </>
          )}

          {/* CTA */}
          {selectedSlot && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">{selectedRoom.external_name}</span>
                <span className="text-gray-400"> · </span>
                {format(new Date(selectedDate + 'T12:00:00'), 'MMM d, yyyy')}
                <span className="text-gray-400"> · </span>
                {selectedSlotLabel}
              </div>
              <Link
                href={`/book/request?room=${selectedRoom.id}&date=${selectedDate}&start=${encodeURIComponent(selectedSlot)}&location=${location.slug}`}
                className="flex-shrink-0 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors text-center"
              >
                Continue to booking →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Fine print */}
      <p className="text-xs text-gray-400 pt-2">
        Bookings are non-refundable. Need to cancel?{' '}
        <a href="mailto:bookings@bizhaus.com" className="underline hover:text-gray-600">Contact us</a>
        {' '}to inquire about credit toward a future booking.
      </p>
    </div>
  )
}
