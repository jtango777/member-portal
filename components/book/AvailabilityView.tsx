'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'
import { ArrowLeft, Check, ImageIcon, Phone, Mail, ChevronLeft, ChevronRight, Clock, CalendarDays, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import MiniDatePicker from '@/components/MiniDatePicker'
import { dateUnavailableReason, lastBookableDate, MAX_BOOKING_MONTHS_AHEAD } from '@/lib/bookingRules'

type BookRoom = {
  id: string
  external_name: string
  capacity: number
  price_per_hour: number
  description?: string | null
}

type BookLocation = {
  id: string
  name: string
  slug: string
}

const CONTACT_PHONE = '(310) 870-1730'
const CONTACT_EMAIL = 'bookings@bizhaus.com'

// Keyed by "location-slug:external_name" — arrays support carousel; first image is the cover
const ROOM_IMAGES: Record<string, string[]> = {
  'el-segundo:Large':     ['/rooms/es-large.jpg'],
  'el-segundo:Medium +':  ['/rooms/es-medium.jpg'],
  'el-segundo:Medium':    ['/rooms/es-medium-plus.jpg'],
  'el-segundo:Small':     ['/rooms/es-small.jpg'],
  'marina-del-rey:Small': ['/rooms/mdr-conference-3.jpg', '/rooms/mdr-conference-2.jpg'],
  'costa-mesa:Large':     ['/rooms/cm-large.jpg', '/rooms/cm-large-2.jpg'],
  'costa-mesa:Medium +':  ['/rooms/cm-medium-plus.jpg'],
  'costa-mesa:Medium':    ['/rooms/cm-medium.jpg'],
  'costa-mesa:Small':     ['/rooms/cm-small.jpg'],
}



// Whole dollars stay clean ($75), half hours show the cents that are
// actually charged — the summary used to round $97.50 up to "$98"
// (found in testing, 2026-09-22).
function money(amount: number) {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`
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

const PT = 'America/Los_Angeles'

// BizHaus locations are all in Pacific time — "today" and "now" need to be
// computed in that zone, not the visitor's local one, or someone browsing
// from the East Coast (or later in the day) could see the wrong date as
// "today" or have past slots miscalculated.
function pacificToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function pacificNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: PT, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  return h * 60 + m
}

export default function AvailabilityView({ location, rooms }: { location: BookLocation; rooms: BookRoom[] }) {
  const today = pacificToday()

  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({})
  const [expandedRoom,  setExpandedRoom]  = useState<string | null>(null)
  const [allDay,        setAllDay]        = useState(false)
  const [selectedRoom,  setSelectedRoom]  = useState<BookRoom | null>(null)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [blockedSlots,  setBlockedSlots]  = useState<string[]>([])
  const [loadingSlots,  setLoadingSlots]  = useState(false)
  const [selectedStart, setSelectedStart] = useState<string>('')
  const [selectedEnd,   setSelectedEnd]   = useState<string>('')
  const widgetRef = useRef<HTMLDivElement>(null)

  // On a phone the booking panel sits under every room card — picking a
  // room left the date and time controls about 2,000px down the page with
  // nothing to show anything had happened (found 2026-09-22). On desktop
  // the panel is already beside the cards, so this only runs when stacked.
  useEffect(() => {
    if (!selectedRoom) return
    if (window.innerWidth >= 1024) return
    widgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedRoom])

  // Weekends, holidays, past dates and anything past the 6-month window —
  // one shared rule with the API routes (lib/bookingRules).
  const unavailableReason = dateUnavailableReason(selectedDate)
  const dateClosed = unavailableReason !== null

  useEffect(() => {
    if (!selectedRoom) return
    setLoadingSlots(true)
    // "All day" used to survive a date change with the times cleared out,
    // which left Proceed to Payment pointing at a booking with no times —
    // it silently bounced people back to the start (found 2026-09-22).
    if (allDay) { setSelectedStart('9:00'); setSelectedEnd('17:00') }
    else { setSelectedStart(''); setSelectedEnd('') }
    // Drop the previous day's slots so nothing is labelled unavailable
    // based on a different date while this fetch is in flight.
    setBlockedSlots([])
    fetch(`/api/book/availability?roomId=${selectedRoom.id}&date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { setBlockedSlots(d.blockedSlots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  // allDay deliberately left out: re-running this on every toggle would
  // refetch availability for no reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, selectedDate])

  // All start times — blocked or already-passed (when booking for today)
  // ones shown as disabled
  const isToday = selectedDate === today
  const startSlotsWithStatus = START_SLOTS.map(s => ({
    ...s,
    disabled: blockedSlots.includes(s.value) || (isToday && slotToMinutes(s.value) <= pacificNowMinutes()),
  }))

  // All end times after selected start — ones crossing a blocked slot shown as disabled
  const endSlotsWithStatus = selectedStart
    ? END_SLOTS
        .filter(end => slotToMinutes(end.value) > slotToMinutes(selectedStart))
        .map(end => ({
          ...end,
          disabled: START_SLOTS.some(s =>
            slotToMinutes(s.value) >= slotToMinutes(selectedStart) &&
            slotToMinutes(s.value) <  slotToMinutes(end.value) &&
            blockedSlots.includes(s.value)
          ),
        }))
    : []

  const validEndSlots = endSlotsWithStatus.filter(s => !s.disabled)

  // Reset end if no longer valid
  useEffect(() => {
    // All day sets its own 9-5 and is policed by allDayBlocked below. This
    // check used to clear its 5:00 PM while the new day's availability was
    // still loading, which left the booking with no end time and the button
    // dead (found 2026-09-22).
    if (allDay) return
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
    const next = format(addDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd')
    if (next > lastBookableDate()) return
    setSelectedDate(next); setSelectedStart(''); setSelectedEnd('')
  }

  // An all-day booking still has to be a free day — the server rejects a
  // clash and refunds, but there's no reason to take the payment at all.
  const allDayBlocked = allDay && START_SLOTS.some(s => blockedSlots.includes(s.value))
  const canContinue = selectedRoom && selectedStart && selectedEnd && !dateClosed && !allDayBlocked

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link href="/book" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} />
        All locations
      </Link>

      {/* No location banner. It was a photo of the open coworking space, not
          a meeting room, and it pushed the rooms below the fold for 300px of
          nothing (Caroline, 2026-09-22). People land here having already
          picked the location, so a heading is enough. */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{location.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Meeting rooms by the hour · Monday to Friday, 9:00 AM – 5:00 PM</p>
      </div>

      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose a room</div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

        {/* ── Left: Room cards ─────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => { setSelectedRoom(room); setSelectedStart(''); setSelectedEnd('') }}
              // Same selected/unselected treatment as the day pass location
              // cards: a ring plus a check instead of a heavy border
              // (matches the day pass design pass, 2026-09-17).
              className={cn(
                'group relative rounded-xl overflow-hidden cursor-pointer transition-all bg-white',
                selectedRoom?.id === room.id
                  ? 'ring-2 ring-booking-600 ring-offset-2 ring-offset-[#FAF9F7]'
                  : 'ring-1 ring-gray-200 hover:ring-gray-300 hover:-translate-y-0.5'
              )}
            >
              {selectedRoom?.id === room.id && (
                <span className="absolute top-3 right-3 z-10 h-6 w-6 rounded-full bg-booking-600 text-white flex items-center justify-center shadow-sm">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
              {/* ── Room image / carousel ── add arrays to ROOM_IMAGES above as photos become available ── */}
              {(() => {
                const images = ROOM_IMAGES[`${location.slug}:${room.external_name}`]
                const idx = carouselIndex[room.id] ?? 0
                return (
                  <div className="relative bg-gray-100 aspect-[4/3] overflow-hidden">
                    {images?.length ? (
                      <>
                        <img
                          src={images[idx]}
                          alt={`${room.external_name} photo ${idx + 1}`}
                          className="w-full h-full object-cover object-[center_65%] transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                        {images.length > 1 && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); setCarouselIndex(p => ({ ...p, [room.id]: (idx - 1 + images.length) % images.length })) }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                            ><ChevronLeft size={15} /></button>
                            <button
                              onClick={e => { e.stopPropagation(); setCarouselIndex(p => ({ ...p, [room.id]: (idx + 1) % images.length })) }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                            ><ChevronRight size={15} /></button>
                            {/* Above the name/price overlay, not behind it. */}
                            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                              {images.map((_, i) => (
                                <button key={i} onClick={e => { e.stopPropagation(); setCarouselIndex(p => ({ ...p, [room.id]: i })) }}
                                  className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === idx ? 'bg-white' : 'bg-white/50')}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                        <ImageIcon size={28} />
                        <span className="text-sm">Photos coming soon</span>
                      </div>
                    )}

                    {/* One scrim over every photo, so rooms shot in different
                        light still read as one set. */}
                    {!!images?.length && (
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/25 to-transparent pointer-events-none" />
                    )}

                    <div className={cn(
                      'absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3 pointer-events-none',
                      images?.length ? 'text-white' : 'text-gray-900'
                    )}>
                      <div>
                        <h3 className="font-semibold leading-tight">{room.external_name}</h3>
                        <p className={cn('text-xs mt-0.5', images?.length ? 'text-white/75' : 'text-gray-500')}>
                          Up to {room.capacity} people
                        </p>
                      </div>
                      <div className={cn(
                        'shrink-0 text-xs font-semibold rounded-full px-2.5 py-1',
                        images?.length ? 'bg-white/15 text-white backdrop-blur-sm' : 'bg-gray-100 text-gray-700'
                      )}>
                        ${room.price_per_hour}/hr
                      </div>
                    </div>
                  </div>
                )
              })()}
              {/* ──────────────────────────────────────────────────────────────────────────────────── */}

              {/* Only when there's something to read. Every room's description
                  is empty right now, so this was "See details on this room"
                  opening onto "Details coming soon." nine times over
                  (Caroline spotted it, 2026-09-22). Fill them in at
                  /dashboard/admin/rooms and the toggle comes back. */}
              {room.description && (
              <div className="px-4 py-3">
                <div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setExpandedRoom(expandedRoom === room.id ? null : room.id) }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ChevronRight
                      size={13}
                      className={cn('transition-transform duration-200', expandedRoom === room.id ? 'rotate-90' : 'rotate-0')}
                    />
                    See details on this room
                  </button>
                  <div className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    expandedRoom === room.id ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'
                  )}>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {room.description}
                    </p>
                  </div>
                </div>
              </div>
              )}
            </div>
          ))}
          </div>

        </div>

        {/* ── Right: Sticky booking widget ─────────────────────────── */}
        {/* Sticky on the grid column itself (as on the day pass) — sticky on
            the inner card did nothing, since its wrapper was only as tall as
            the card. Desktop only; on phones it just stacks below the rooms. */}
        <div ref={widgetRef} className="lg:col-span-2 lg:sticky lg:top-6 scroll-mt-4">
          <div className={cn(
            'bg-white rounded-xl overflow-hidden transition-all',
            selectedRoom
              ? 'ring-1 ring-booking-600/30 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-8px_rgba(16,24,40,0.12)]'
              : 'ring-1 ring-gray-200/80'
          )}>

            {!selectedRoom ? (
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Pick a room to see times</div>
                  <p className="text-sm text-gray-500 mt-1">Availability is live, so anything you can select is free.</p>
                </div>
                <ul className="space-y-2.5 text-sm text-gray-600 border-t border-gray-100 pt-4">
                  <li className="flex items-start gap-2">
                    <Clock size={15} className="mt-0.5 shrink-0 text-booking-600" />
                    Monday to Friday, 9:00 AM to 5:00 PM
                  </li>
                  <li className="flex items-start gap-2">
                    <CalendarDays size={15} className="mt-0.5 shrink-0 text-booking-600" />
                    From 30 minutes, up to {MAX_BOOKING_MONTHS_AHEAD} months ahead
                  </li>
                  <li className="flex items-start gap-2">
                    <Users size={15} className="mt-0.5 shrink-0 text-booking-600" />
                    No membership needed, pay by card
                  </li>
                </ul>
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
                        <MiniDatePicker
                          value={selectedDate}
                          onChange={v => { setSelectedDate(v); setSelectedStart(''); setSelectedEnd('') }}
                          maxDate={lastBookableDate()}
                          dayUnavailable={dateUnavailableReason}
                        />
                      </div>
                      <button onClick={nextDay} disabled={selectedDate >= lastBookableDate()}
                        className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Weekend, holiday, past date or beyond the booking window */}
                  {dateClosed ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                      <p className="text-sm font-medium text-amber-800">{unavailableReason}</p>
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
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</label>
                          <button
                            type="button"
                            disabled={isToday && pacificNowMinutes() >= slotToMinutes('9:00')}
                            onClick={() => {
                              const next = !allDay
                              setAllDay(next)
                              if (next) { setSelectedStart('9:00'); setSelectedEnd('17:00') }
                              else      { setSelectedStart('');     setSelectedEnd('')      }
                            }}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span className={cn(
                              'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                              allDay ? 'bg-booking-600' : 'bg-gray-300'
                            )}>
                              <span className={cn(
                                'inline-block h-3 w-3 rounded-full bg-white shadow transition-transform',
                                allDay ? 'translate-x-3.5' : 'translate-x-0.5'
                              )} />
                            </span>
                            All day
                          </button>
                        </div>
                        {loadingSlots ? (
                          <p className="text-sm text-gray-400">Loading availability…</p>
                        ) : allDay ? (
                          allDayBlocked ? (
                            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              This room is already booked for part of that day. Turn off All day and pick times that are free.
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">9:00 AM – 5:00 PM</p>
                          )
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={selectedStart}
                              onChange={e => { setSelectedStart(e.target.value); setSelectedEnd('') }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500 bg-white"
                            >
                              <option value="">Start time</option>
                              {startSlotsWithStatus.map(s => (
                                <option key={s.value} value={s.value} disabled={s.disabled}>
                                  {s.label}{s.disabled ? ' — Unavailable' : ''}
                                </option>
                              ))}
                            </select>
                            <select
                              value={selectedEnd}
                              onChange={e => setSelectedEnd(e.target.value)}
                              disabled={!selectedStart || endSlotsWithStatus.length === 0}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500 bg-white disabled:opacity-40"
                            >
                              <option value="">End time</option>
                              {endSlotsWithStatus.map(s => (
                                <option key={s.value} value={s.value} disabled={s.disabled}>
                                  {s.label}{s.disabled ? ' — Unavailable' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Estimated total */}
                      {durationHours > 0 && (
                        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-gray-500">{durationHours}h · ${selectedRoom.price_per_hour}/hr</span>
                          <span className="font-semibold text-gray-900">Est. {money(estimatedTotal)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* CTA */}
                {!dateClosed && (
                  <div className="px-5 py-4">
                    {canContinue ? (
                      <Link
                        href={`/book/request?room=${selectedRoom.id}&date=${selectedDate}&start=${encodeURIComponent(selectedStart)}&end=${encodeURIComponent(selectedEnd)}&location=${location.slug}`}
                        className="block w-full text-center bg-booking-600 hover:bg-booking-700 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
                      >
                        Proceed to Payment →
                      </Link>
                    ) : (
                      <button disabled
                        className="w-full bg-booking-200 text-white text-sm font-semibold py-3 rounded-lg cursor-not-allowed">
                        Request Booking →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* After-hours note */}
            {selectedRoom && !dateClosed && (
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
      <p className="text-xs text-gray-500 pt-4 border-t border-gray-200">
        Rooms are bookable Monday to Friday, 9:00 AM to 5:00 PM, up to {MAX_BOOKING_MONTHS_AHEAD} months ahead.
      </p>
      <p className="text-xs font-semibold text-gray-800">
        Bookings are non-refundable. Need to cancel?{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-gray-600">Contact us</a>
        {' '}to inquire about credit toward a future booking.
      </p>
    </div>
  )
}
