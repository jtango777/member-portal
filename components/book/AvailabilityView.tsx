'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Mail } from 'lucide-react'
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

const CONTACT_PHONE = '(310) 870-1730'
const CONTACT_EMAIL = 'bookings@bizhaus.com'


function slotToMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number)
  return h * 60 + m
}

// Start times: 9:00 AM – 4:30 PM
const START_SLOTS: { value: string; label: string }[] = []
for (let h = 9; h < 17; h++) {
  for (const m of [0, 30]) {
    if (h === 16 && m === 30) {
      START_SLOTS.push({ value: '16:30', label: '4:30 PM' })
      break
    }
    START_SLOTS.push({
      value: `${h}:${m.toString().padStart(2, '0')}`,
      label: format(new Date(2000, 0, 1, h, m), 'h:mm a'),
    })
  }
}

// End times: 9:30 AM – 5:00 PM
const END_SLOTS: { value: string; label: string }[] = []
for (let h = 9; h <= 17; h++) {
  for (const m of [0, 30]) {
    if (h === 9 && m === 0) continue
    if (h === 17 && m === 30) continue
    END_SLOTS.push({
      value: `${h}:${m.toString().padStart(2, '0')}`,
      label: format(new Date(2000, 0, 1, h, m), 'h:mm a'),
    })
  }
}


function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 0 || day === 6
}

export default function AvailabilityView({ location, rooms }: { location: BookLocation; rooms: BookRoom[] }) {
  const today = format(new Date(), 'yyyy-MM-dd')

  const [selectedRoom,    setSelectedRoom]    = useState<BookRoom | null>(null)
  const [selectedDate,    setSelectedDate]    = useState(today)
  const [blockedSlots,    setBlockedSlots]    = useState<string[]>([])
  const [loadingSlots,    setLoadingSlots]    = useState(false)
  const [selectedStart,   setSelectedStart]   = useState<string | null>(null)
  const [selectedEnd,     setSelectedEnd]     = useState<string | null>(null)

  const weekend = isWeekend(selectedDate)

  useEffect(() => {
    if (!selectedRoom) return
    setLoadingSlots(true)
    setSelectedStart(null); setSelectedEnd(null)
    fetch(`/api/book/availability?roomId=${selectedRoom.id}&date=${selectedDate}`)
      .then(r => r.json())
      .then(data => { setBlockedSlots(data.blockedSlots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [selectedRoom, selectedDate])

  // Valid end times: after start, up to 5pm, with no blocked slots in between
  const validEndSlots = selectedStart
    ? END_SLOTS.filter(end => {
        if (slotToMinutes(end.value) <= slotToMinutes(selectedStart)) return false
        // Reject if any slot between start and end is blocked
        return !START_SLOTS.some(s =>
          slotToMinutes(s.value) >= slotToMinutes(selectedStart) &&
          slotToMinutes(s.value) <  slotToMinutes(end.value) &&
          blockedSlots.includes(s.value)
        )
      })
    : []

  // Reset end if it's no longer valid after start changes
  useEffect(() => {
    if (selectedEnd && !validEndSlots.find(s => s.value === selectedEnd)) {
      setSelectedEnd(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStart])

  function prevDay() {
    const prev = format(subDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd')
    if (prev >= today) { setSelectedDate(prev); setSelectedStart(null); setSelectedEnd(null) }
  }
  function nextDay() {
    setSelectedDate(format(addDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd'))
    setSelectedStart(null); setSelectedEnd(null)
  }

  const startLabel = START_SLOTS.find(s => s.value === selectedStart)?.label
  const endLabel   = END_SLOTS.find(s => s.value === selectedEnd)?.label

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

      {/* Step 1 — Room */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Step 1 · Select a room</p>
        <p className="text-xs text-gray-400 mb-3">
          Rooms are furnished to their listed capacity. Please select a room that comfortably fits your group — we can't guarantee additional seating beyond what's listed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map(room => (
            <button key={room.id}
              onClick={() => { setSelectedRoom(room); setSelectedStart(null); setSelectedEnd(null) }}
              className={cn(
                'text-left border rounded-xl px-5 py-4 transition-colors',
                selectedRoom?.id === room.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              )}>
              <div className="font-semibold text-base">{room.external_name}</div>
              <div className={cn('text-sm mt-1', selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-500')}>
                Up to {room.capacity} people · ${room.price_per_hour}/hr
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3 — Date */}
      {selectedRoom && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Step 2 · Pick a date</p>
          <div className="flex items-center gap-2">
            <button onClick={prevDay} disabled={selectedDate <= today}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="w-48">
              <MiniDatePicker value={selectedDate} onChange={v => { setSelectedDate(v); setSelectedStart(null); setSelectedEnd(null) }} />
            </div>
            <button onClick={nextDay} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekend message */}
          {weekend && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-2">
              <p className="text-sm font-semibold text-amber-800">Weekend bookings require advance arrangement.</p>
              <p className="text-sm text-amber-700">Please contact us directly to schedule outside of Monday–Friday business hours.</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <a href={`tel:${CONTACT_PHONE.replace(/\D/g,'')}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-900">
                  <Phone size={13} /> {CONTACT_PHONE}
                </a>
                <a href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-900">
                  <Mail size={13} /> {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Time selection (weekdays only) */}
      {selectedRoom && !weekend && (
        <div className="space-y-6">
          {/* Start time */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Step 3 · Select a start time</p>
            {loadingSlots ? (
              <p className="text-sm text-gray-400">Loading availability…</p>
            ) : (
              <>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {START_SLOTS.map(slot => {
                    const isBlocked  = blockedSlots.includes(slot.value)
                    const isSelected = selectedStart === slot.value
                    return (
                      <button key={slot.value} disabled={isBlocked}
                        onClick={() => { setSelectedStart(isSelected ? null : slot.value); setSelectedEnd(null) }}
                        className={cn(
                          'py-2 px-1 rounded-lg text-sm font-medium border transition-colors text-center',
                          isBlocked
                            ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        )}>
                        {slot.label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block" /> Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gray-100 border border-gray-100 inline-block" /> Unavailable
                  </span>
                </div>
              </>
            )}
          </div>

          {/* End time */}
          {selectedStart && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Step 4 · Select an end time</p>
              {validEndSlots.length === 0 ? (
                <p className="text-sm text-gray-500">No available end times from {startLabel} — the room is booked shortly after. Please choose a different start time.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {validEndSlots.map(slot => (
                    <button key={slot.value}
                      onClick={() => setSelectedEnd(selectedEnd === slot.value ? null : slot.value)}
                      className={cn(
                        'py-2 px-1 rounded-lg text-sm font-medium border transition-colors text-center',
                        selectedEnd === slot.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      )}>
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          {selectedStart && selectedEnd && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">{selectedRoom.external_name}</span>
                <span className="text-gray-400"> · </span>
                {format(new Date(selectedDate + 'T12:00:00'), 'MMM d, yyyy')}
                <span className="text-gray-400"> · </span>
                {startLabel} – {endLabel}
                <span className="text-gray-400"> · </span>
                <span className="font-medium text-blue-700">
                  ${selectedRoom.price_per_hour}/hr
                </span>
              </div>
              <Link
                href={`/book/request?room=${selectedRoom.id}&date=${selectedDate}&start=${encodeURIComponent(selectedStart)}&end=${encodeURIComponent(selectedEnd)}&location=${location.slug}`}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors text-center"
              >
                Continue to booking →
              </Link>
            </div>
          )}

          {/* After-hours note */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500">Need time outside of 9 AM – 5 PM, Monday–Friday?</p>
            <div className="flex gap-4">
              <a href={`tel:${CONTACT_PHONE.replace(/\D/g,'')}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800">
                <Phone size={13} /> {CONTACT_PHONE}
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800">
                <Mail size={13} /> {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Fine print */}
      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        Bookings are non-refundable. Need to cancel?{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-gray-600">Contact us</a>
        {' '}to inquire about credit toward a future booking.
      </p>
    </div>
  )
}
