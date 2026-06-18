'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'
import { ArrowLeft, ImageIcon, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react'
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

// Keyed by "location-slug:external_name" — add entries as photos become available
const ROOM_IMAGES: Record<string, string> = {
  'el-segundo:Large':     '/rooms/es-large.jpg',
  'el-segundo:Medium +':  '/rooms/es-medium-plus.jpg',
  'el-segundo:Medium':    '/rooms/es-medium.jpg',
  'marina-del-rey:Small': '/rooms/mdr-conference-3.jpg',
  'costa-mesa:Large':     '/rooms/cm-large.jpg',
  'costa-mesa:Medium +':  '/rooms/cm-medium-plus.jpg',
  'costa-mesa:Medium':    '/rooms/cm-medium.jpg',
  'costa-mesa:Small':     '/rooms/cm-small.jpg',
}


function slotToMinutes(s: string) {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

// Start times: 9:00 AM – 4:30 PM
const START_SLOTS: { value: string; label: string }[] = []
for (let h = 9; h < 17; h++) {
  for (const m of [0, 30]) {
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

function isWeekend(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00').getDay()
  return d === 0 || d === 6
}

export default function AvailabilityView({ location, rooms }: { location: BookLocation; rooms: BookRoom[] }) {
  const today = format(new Date(), 'yyyy-MM-dd')

  const [selectedRoom,  setSelectedRoom]  = useState<BookRoom | null>(null)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [blockedSlots,  setBlockedSlots]  = useState<string[]>([])
  const [loadingSlots,  setLoadingSlots]  = useState(false)
  const [selectedStart, setSelectedStart] = useState<string>('')
  const [selectedEnd,   setSelectedEnd]   = useState<string>('')

  const weekend = isWeekend(selectedDate)

  useEffect(() => {
    if (!selectedRoom) return
    setLoadingSlots(true)
    setSelectedStart(''); setSelectedEnd('')
    fetch(`/api/book/availability?roomId=${selectedRoom.id}&date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { setBlockedSlots(d.blockedSlots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [selectedRoom, selectedDate])

  // Available start times — exclude blocked
  const availableStartSlots = START_SLOTS.filter(s => !blockedSlots.includes(s.value))

  // Valid end times — after selected start, no blocked slots in range
  const validEndSlots = selectedStart
    ? END_SLOTS.filter(end => {
        if (slotToMinutes(end.value) <= slotToMinutes(selectedStart)) return false
        return !START_SLOTS.some(s =>
          slotToMinutes(s.value) >= slotToMinutes(selectedStart) &&
          slotToMinutes(s.value) <  slotToMinutes(end.value) &&
          blockedSlots.includes(s.value)
        )
      })
    : []

  // Reset end if no longer valid
  useEffect(() => {
    if (selectedEnd && !validEndSlots.find(s => s.value === selectedEnd)) setSelectedEnd('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStart, blockedSlots])

  const durationHours = selectedStart && selectedEnd
    ? (slotToMinutes(selectedEnd) - slotToMinutes(selectedStart)) / 60
    : 0

  const estimatedTotal = selectedRoom ? durationHours * selectedRoom.price_per_hour : 0

  const startLabel = START_SLOTS.find(s => s.value === selectedStart)?.label
  const endLabel   = END_SLOTS.find(s => s.value === selectedEnd)?.label

  function prevDay() {
    const prev = format(subDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd')
    if (prev >= today) { setSelectedDate(prev); setSelectedStart(''); setSelectedEnd('') }
  }
  function nextDay() {
    setSelectedDate(format(addDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd'))
    setSelectedStart(''); setSelectedEnd('')
  }

  const canContinue = selectedRoom && selectedStart && selectedEnd && !weekend

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link href="/book" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} />
        All locations
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{location.name}</h1>
        <p className="text-gray-500 mt-1">Select a room and pick your date and time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

        {/* ── Left: Room cards ─────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <p className="text-xs text-gray-400">
            Rooms are furnished to their listed capacity. Please select a room that comfortably fits your group.
          </p>

          <div className="grid grid-cols-2 gap-4">
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => { setSelectedRoom(room); setSelectedStart(''); setSelectedEnd('') }}
              className={cn(
                'rounded-xl border overflow-hidden cursor-pointer transition-all bg-white',
                selectedRoom?.id === room.id
                  ? 'border-blue-600 ring-2 ring-blue-100 shadow-sm'
                  : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
              )}
            >
              {/* ── Room image ── add entries to ROOM_IMAGES above as photos become available ── */}
              <div className="relative bg-gray-100 aspect-[16/9] overflow-hidden">
                {ROOM_IMAGES[`${location.slug}:${room.external_name}`] ? (
                  <img
                    src={ROOM_IMAGES[`${location.slug}:${room.external_name}`]}
                    alt={room.external_name}
                    className="w-full h-full object-cover object-[center_65%]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                    <ImageIcon size={28} />
                    <span className="text-sm">Photos coming soon</span>
                  </div>
                )}
              </div>
              {/* ──────────────────────────────────────────────────────────────────────────────────── */}

              <div className="px-5 py-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">{room.external_name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Up to {room.capacity} people</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-semibold text-gray-900">${room.price_per_hour}</span>
                    <span className="text-gray-400 text-sm">/hr</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>

        </div>

        {/* ── Right: Sticky booking widget ─────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

            {!selectedRoom ? (
              <div className="p-6 text-center text-sm text-gray-400 py-12">
                ← Select a room to continue
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Room summary */}
                <div className="px-5 py-4">
                  <p className="font-semibold text-gray-900">{selectedRoom.external_name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Up to {selectedRoom.capacity} people · ${selectedRoom.price_per_hour}/hr
                  </p>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {/* Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                    <div className="flex items-center gap-1.5">
                      <button onClick={prevDay} disabled={selectedDate <= today}
                        className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                      <div className="flex-1">
                        <MiniDatePicker value={selectedDate} onChange={v => { setSelectedDate(v); setSelectedStart(''); setSelectedEnd('') }} />
                      </div>
                      <button onClick={nextDay}
                        className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Weekend message */}
                  {weekend ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                      <p className="text-sm font-medium text-amber-800">Weekend bookings require advance arrangement.</p>
                      <div className="flex flex-col gap-1">
                        <a href={`tel:${CONTACT_PHONE.replace(/\D/g,'')}`}
                          className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900">
                          <Phone size={12} /> {CONTACT_PHONE}
                        </a>
                        <a href={`mailto:${CONTACT_EMAIL}`}
                          className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900">
                          <Mail size={12} /> {CONTACT_EMAIL}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Start / End time */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Time</label>
                        {loadingSlots ? (
                          <p className="text-sm text-gray-400">Loading availability…</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={selectedStart}
                              onChange={e => { setSelectedStart(e.target.value); setSelectedEnd('') }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Start time</option>
                              {availableStartSlots.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                            <select
                              value={selectedEnd}
                              onChange={e => setSelectedEnd(e.target.value)}
                              disabled={!selectedStart || validEndSlots.length === 0}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-40"
                            >
                              <option value="">End time</option>
                              {validEndSlots.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Estimated total */}
                      {durationHours > 0 && (
                        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-gray-500">{durationHours}h · ${selectedRoom.price_per_hour}/hr</span>
                          <span className="font-semibold text-gray-900">Est. ${estimatedTotal.toFixed(0)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* CTA */}
                {!weekend && (
                  <div className="px-5 py-4">
                    {canContinue ? (
                      <Link
                        href={`/book/request?room=${selectedRoom.id}&date=${selectedDate}&start=${encodeURIComponent(selectedStart)}&end=${encodeURIComponent(selectedEnd)}&location=${location.slug}`}
                        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
                      >
                        Request Booking →
                      </Link>
                    ) : (
                      <button disabled
                        className="w-full bg-blue-200 text-white text-sm font-semibold py-3 rounded-lg cursor-not-allowed">
                        Request Booking →
                      </button>
                    )}
                    <p className="text-xs text-gray-400 text-center mt-3">
                      Payment collected after confirmation. We'll follow up within 1 business day.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* After-hours note */}
            {selectedRoom && !weekend && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-600">
                  Need outside 9 AM–5 PM Monday–Friday?{' '}
                  <a href={`tel:${CONTACT_PHONE.replace(/\D/g,'')}`} className="font-medium underline hover:text-gray-900">{CONTACT_PHONE}</a>
                  {' '}or{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline hover:text-gray-900">{CONTACT_EMAIL}</a>
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Fine print */}
      <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
        Bookings are non-refundable. Need to cancel?{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-gray-600">Contact us</a>
        {' '}to inquire about credit toward a future booking.
      </p>
    </div>
  )
}
