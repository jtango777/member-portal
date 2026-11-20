'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'
import { ArrowLeft, Check, ImageIcon, Phone, Mail, ChevronLeft, ChevronRight, Clock, Users, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import MiniDatePicker from '@/components/MiniDatePicker'
import Collapse from '@/components/Collapse'
import DayGrid from '@/components/book/DayGrid'
import MonthPanel from '@/components/book/MonthPanel'
import { dateUnavailableReason, isWeekendDate, lastBookableDate, type ClosureMap } from '@/lib/bookingRules'
import { bookingPhoneFor } from '@/lib/locations'
import {
  freeBlocks, longestBlock, blockHours, describeFreeTime, rankSuggestions, busyBlocks,
  type FreeBlock,
} from '@/lib/roomSuggestions'

type BookRoom = {
  id: string
  external_name: string
  capacity: number
  price_per_hour: number
  description?: string | null
  photo_urls?: string[] | null
}

type BookLocation = {
  id: string
  name: string
  slug: string
}

const CONTACT_EMAIL = 'bookings@bizhaus.com'

// Room photos come from rooms.photo_urls, chosen by admins on Conference
// Rooms -> External Rooms (Joe, 2026-10-26); several make a carousel and the
// first is the cover. They were a list here until then. Note for anyone
// looking at public/rooms: es-medium.jpg shows the Medium + room and
// es-medium-plus.jpg the Medium. The filenames are wrong, not the
// assignment (Caroline, 2026-10-01; see migration 062).



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

export default function AvailabilityView({ location, rooms, closures }: { location: BookLocation; rooms: BookRoom[]; closures: ClosureMap }) {
  const today = pacificToday()
  // This location's own number, not the El Segundo main line.
  const phone = bookingPhoneFor(location.id)

  /**
   * Photos or the whole day's grid.
   *
   * Photos first, because most people arrive knowing roughly what they
   * want and choose with their eyes. The grid is for the harder question,
   * "what is actually free", and for anybody whose first choice turns out
   * to be taken (Caroline, 2026-11-19).
   */
  const [view, setView] = useState<'rooms' | 'calendar'>('rooms')
  /** Mid-swap, so the two views cross-fade instead of jumping. */
  const [swapping, setSwapping] = useState(false)
  function switchView() {
    setSwapping(true)
    setTimeout(() => { setView(v => (v === 'rooms' ? 'calendar' : 'rooms')); setSwapping(false) }, 130)
  }

  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({})

  /**
   * Fetch a room's other photos before anybody asks for one.
   *
   * The carousel swaps the src on a single <img>, so photo 2 was not
   * requested until the arrow was clicked, and then the click sat there
   * for about a second and a half while it downloaded. Measured on the
   * live site: the request starts 6ms after the click and the download is
   * the whole delay (Caroline, 2026-11-18).
   *
   * Pulled in on hover and on the first arrow click rather than on page
   * load, because a location page is eleven rooms and loading every photo
   * of every one of them to save a click nobody may make is a worse trade
   * on a phone than the click itself.
   */
  const warmed = useRef<Set<string>>(new Set())
  function warmPhotos(room: { id: string; photo_urls?: string[] | null }) {
    if (warmed.current.has(room.id)) return
    warmed.current.add(room.id)
    for (const url of (room.photo_urls ?? []).slice(1)) {
      const img = new Image()
      img.src = url
    }
  }
  const [expandedRoom,  setExpandedRoom]  = useState<string | null>(null)
  const [allDay,        setAllDay]        = useState(false)
  const [selectedRoom,  setSelectedRoom]  = useState<BookRoom | null>(null)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [blockedSlots,  setBlockedSlots]  = useState<string[]>([])
  // Days this room has no free half hour on at all, so the picker can grey
  // them out instead of letting someone choose a date and then find every
  // time slot says Unavailable (Caroline, 2026-10-01). Fetched once per
  // room for the whole booking window, which is cheaper and simpler than
  // following the calendar's month as it moves.
  const [fullDays, setFullDays] = useState<Set<string>>(new Set())
  const [loadingSlots,  setLoadingSlots]  = useState(false)
  /**
   * Every room's taken slots for the chosen date, in one call rather
   * than one per room (Caroline, 2026-11-18).
   */
  const [blockedByRoom, setBlockedByRoom] = useState<Record<string, string[]>>({})
  const [selectedStart, setSelectedStart] = useState<string>('')
  const [selectedEnd,   setSelectedEnd]   = useState<string>('')
  const widgetRef = useRef<HTMLDivElement>(null)
  /** The grid, so "see what is free" lands on it rather than near it. */
  const gridRef = useRef<HTMLDivElement>(null)
  /**
   * A time picked off the grid, waiting for its room to finish loading.
   *
   * Choosing a room clears the times, which is right when somebody picks
   * a room from a card and starts again, and wrong here: the grid click
   * chooses the room AND the time in one go, and the clearing landed
   * after it and wiped the time (Caroline, 2026-11-19).
   */
  const pendingPick = useRef<{ roomId: string; start: string; end: string } | null>(null)

  // A room is chosen by clicking its photo or from the dropdown in the
  // booking panel (Joe, 2026-10-28); either way any times picked for the
  // previous room are cleared.
  function selectRoom(room: BookRoom) {
    setSelectedRoom(room)
    setSelectedStart('')
    setSelectedEnd('')
  }

  // Dropdown labels. Two rooms can share a name (Costa Mesa had two
  // "Small"s), so a repeated name gets #1, #2 in the order the cards show.
  const roomLabels = (() => {
    const seen: Record<string, number> = {}
    const total: Record<string, number> = {}
    rooms.forEach(r => { total[r.external_name] = (total[r.external_name] ?? 0) + 1 })
    return Object.fromEntries(rooms.map(r => {
      const n = (seen[r.external_name] = (seen[r.external_name] ?? 0) + 1)
      const name = total[r.external_name] > 1 ? `${r.external_name} #${n}` : r.external_name
      return [r.id, `${name} · up to ${r.capacity} · ${money(r.price_per_hour)}/hr`]
    }))
  })()

  const roomPicker = (
    <select
      aria-label="Room"
      value={selectedRoom?.id ?? ''}
      onChange={e => { const r = rooms.find(x => x.id === e.target.value); if (r) selectRoom(r) }}
      className={cn(
        'w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-booking-600',
        selectedRoom ? 'border-gray-200 font-semibold text-gray-900' : 'border-gray-300 text-gray-700'
      )}
    >
      {!selectedRoom && <option value="" disabled>Choose a room…</option>}
      {rooms.map(r => <option key={r.id} value={r.id}>{roomLabels[r.id]}</option>)}
    </select>
  )

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
  const unavailableReason = dateUnavailableReason(selectedDate, closures, phone)
  const dateClosed = unavailableReason !== null

  /**
   * What the calendar says over a day nobody can book. The grid used to
   * draw a shut day as a completely empty building and hand out a Book
   * button on it (Caroline, 2026-11-20).
   */
  const closedNote = !dateClosed ? null
    : isWeekendDate(selectedDate)
    ? {
        heading: 'Weekends are not self-serve',
        detail: 'Online booking runs Monday to Friday, 9 AM to 5 PM. We do open at weekends by arrangement, so call or email and we will set it up.',
        // The one closed day where getting in touch leads somewhere.
        contact: { phone, email: CONTACT_EMAIL },
      }
    : closures[selectedDate]
    ? {
        heading: `Closed for ${closures[selectedDate]}`,
        detail: 'The building is shut that day. Please pick another.',
      }
    : {
        heading: 'Not available this day',
        detail: unavailableReason,
      }

  // Fully booked days for this room, loaded once per room rather than per
  // date, since the picker shows a whole month at a time.
  useEffect(() => {
    if (!selectedRoom) { setFullDays(new Set()); return }
    let cancelled = false
    fetch(`/api/book/availability?roomId=${selectedRoom.id}&fullDays=1`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setFullDays(new Set<string>(d.fullDays ?? [])) })
      .catch(() => { if (!cancelled) setFullDays(new Set()) })
    return () => { cancelled = true }
  }, [selectedRoom])

  /**
   * The whole location's day, on its own.
   *
   * This used to ride along with the selected room's fetch, which meant
   * it never ran until somebody picked a room, and the full calendar
   * showed every room free all day to anyone who opened it first
   * (Caroline, 2026-11-19).
   */
  useEffect(() => {
    let cancelled = false
    setBlockedByRoom({})
    fetch(`/api/book/availability?locationId=${location.id}&date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setBlockedByRoom(d.blockedByRoom ?? {}) })
      .catch(() => { if (!cancelled) setBlockedByRoom({}) })
    return () => { cancelled = true }
  }, [location.id, selectedDate])

  useEffect(() => {
    if (!selectedRoom) return
    setLoadingSlots(true)
    // "All day" used to survive a date change with the times cleared out,
    // which left Proceed to Payment pointing at a booking with no times —
    // it silently bounced people back to the start (found 2026-09-22).
    const pick = pendingPick.current
    if (pick && pick.roomId === selectedRoom.id) {
      pendingPick.current = null
      setSelectedStart(pick.start)
      setSelectedEnd(pick.end)
    }
    else if (allDay) { setSelectedStart('9:00'); setSelectedEnd('17:00') }
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

  /**
   * Whether a whole day is even possible on the chosen date.
   *
   * All day is 9:00 to 5:00, so once nine has gone it cannot be had
   * today, whatever any room's calendar says.
   */
  const allDayPossible = !(isToday && pacificNowMinutes() >= slotToMinutes('9:00'))

  /**
   * Turn All day off when it stops being possible.
   *
   * Switching it on for tomorrow and then stepping back to today left it
   * on, and because the toggle is disabled today there was no way to
   * switch it off again: the panel sat there warning about a booking
   * nobody could make or undo (Caroline, 2026-11-18).
   */
  useEffect(() => {
    if (!allDayPossible && allDay) {
      setAllDay(false)
      setSelectedStart('')
      setSelectedEnd('')
    }
  }, [allDayPossible, allDay])
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

  /**
   * When the room they picked cannot do what they asked, say what can.
   *
   * Two dead ends: All day on a day with something already in it, and a
   * day with no free half hour left at all. Both used to end with the
   * customer being told to go and look for themselves.
   */
  const slotValues = START_SLOTS.map(s => s.value)
  /**
   * Hours that have already gone, which are as unbookable as booked ones.
   *
   * The free-time maths is built from what each room has booked, and
   * nothing in it says what time it is. On today's date that meant a room
   * with an empty calendar was offered as "free all day" at twenty to
   * twelve, and the hours counted in "2 hours free, in 3 parts" included
   * ones that were already over (Caroline, 2026-11-18).
   */
  const pastSlots = isToday
    ? slotValues.filter(v => slotToMinutes(v) <= pacificNowMinutes())
    : []
  const unavailableIn = (booked: string[] | undefined) => [...(booked ?? []), ...pastSlots]
  const CLOSE_SLOT = '17:00'
  const WHOLE_DAY_HOURS = (slotToMinutes(CLOSE_SLOT) - slotToMinutes(slotValues[0])) / 60
  const noTimeLeft = !loadingSlots && !dateClosed && !!selectedRoom
    && startSlotsWithStatus.every(s => s.disabled)
  const showSuggestions = !dateClosed && !loadingSlots && (allDayBlocked || noTimeLeft)

  // What is left in the room they actually wanted, which beats moving
  // them if there is a decent run of it.
  const ownBlocks = selectedRoom
    ? freeBlocks(slotValues, unavailableIn(blockedSlots), CLOSE_SLOT)
    : []
  const ownBest = longestBlock(ownBlocks)
  /**
   * Offer to keep this room only when most of the day is still there.
   *
   * The floor was an hour, which meant somebody who asked for a whole day
   * could be offered a single leftover hour in it, dressed up as the
   * first and best option. Staying put only beats moving when what is
   * left is close to what they asked for, so the bar is three quarters of
   * the day: six hours of the eight (Caroline, 2026-11-19).
   */
  const KEEP_ROOM_FRACTION = 0.75
  const keepOwn = !!ownBest && blockHours(ownBest) >= WHOLE_DAY_HOURS * KEEP_ROOM_FRACTION

  const wantHours = allDay ? WHOLE_DAY_HOURS : (durationHours || 1)
  const suggestions = showSuggestions && selectedRoom
    ? rankSuggestions({
        chosen: selectedRoom,
        rooms,
        blockedByRoom: Object.fromEntries(
          rooms.map(r => [r.id, unavailableIn(blockedByRoom[r.id])]),
        ),
        startSlots: slotValues,
        closeSlot: CLOSE_SLOT,
        wantHours,
        wholeDayHours: WHOLE_DAY_HOURS,
      })
    : []

  /** Take one of the offers: same date, the times that are actually free. */
  function takeBlock(room: BookRoom, block: FreeBlock) {
    setSelectedRoom(room)
    setAllDay(blockHours(block) >= WHOLE_DAY_HOURS)
    setSelectedStart(block.start)
    setSelectedEnd(block.end)
    warmPhotos(room)
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/book" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} />
        All locations
      </Link>

      {/* No location banner. It was a photo of the open coworking space, not
          a meeting room, and it pushed the rooms below the fold for 300px of
          nothing (Caroline, 2026-09-22). People land here having already
          picked the location, so a heading is enough. */}
      {/* The view switch belongs to the page, not to the left column. Sat
          inside the column it pushed the rooms and the calendar a row
          further down than the panel beside them, so the two halves of
          the page never started level (Caroline, 2026-11-20). */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{location.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Meeting rooms by the hour · Monday to Friday, 9:00 AM – 5:00 PM</p>
        </div>
        {/* One control, in one place, saying one thing.
            A heading that changed AND a link that changed meant two
            bits of text morphing on every press, and the browser drew
            a square focus box over the link afterwards
            (Caroline, 2026-11-19). */}
        <button
          type="button"
          onClick={switchView}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-gray-500
                     hover:text-gray-900 hover:bg-gray-100 transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-booking-500"
        >
          <CalendarDays size={14} />
          {view === 'rooms' ? 'View full calendar' : 'View rooms'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left: Room cards, or the whole day ───────────────────── */}
        <div ref={gridRef} className="lg:col-span-8 space-y-4 scroll-mt-4">

          <div className={cn(
            'transition-opacity duration-150',
            swapping ? 'opacity-0' : 'opacity-100',
          )}>
          {view === 'calendar' ? (
            /* Nothing is highlighted while the selection cannot be booked:
               All day on a part-booked room left a green sliver on
               whatever half hour happened to be free, which read as a
               booking somebody could have (Caroline, 2026-11-19). */
            <>
            <DayGrid
              closedNote={closedNote}
              // The grid carries its own day controls: the date picker
              // lives in the booking panel, which does not appear until a
              // room is chosen, so the calendar opened on today with no
              // way to move (Caroline, 2026-11-19).
              dayLabel={format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMM d')}
              onPrevDay={prevDay}
              onNextDay={nextDay}
              canPrevDay={selectedDate > today}
              canNextDay={selectedDate < lastBookableDate()}
              rooms={rooms}
              slots={slotValues}
              // END_SLOTS as well as START_SLOTS: a block that runs to
              // closing ends at 17:00, which is not a start time, and
              // printed as the raw "17:00".
              labelFor={v =>
                START_SLOTS.find(s => s.value === v)?.label
                ?? END_SLOTS.find(s => s.value === v)?.label
                ?? v}
              closeSlot={CLOSE_SLOT}
              busy={roomId => busyBlocks(slotValues, blockedByRoom[roomId] ?? [], CLOSE_SLOT)}
              nowMinutes={isToday ? pacificNowMinutes() : null}
              selectedRoomId={selectedRoom?.id}
              selectedStart={allDayBlocked ? undefined : selectedStart}
              selectedEnd={allDayBlocked ? undefined : selectedEnd}
              onSelect={(roomId, start, end) => {
                const room = rooms.find(r => r.id === roomId)
                if (!room) return
                setAllDay(false)
                if (room.id !== selectedRoom?.id) {
                  // The room's own availability is about to load and will
                  // clear the times; leave the pick for it to apply.
                  pendingPick.current = { roomId: room.id, start, end }
                  setSelectedRoom(room)
                } else {
                  setSelectedStart(start)
                  setSelectedEnd(end)
                }
              }}
              onClear={() => { setAllDay(false); setSelectedStart(''); setSelectedEnd('') }}
              outsideHoursContact={{ phone, email: CONTACT_EMAIL }}
              bookHref={(roomId, start, end) =>
                `/book/request?room=${roomId}&date=${selectedDate}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&location=${location.slug}`}
              priceFor={(roomId, start, end) => {
                const r = rooms.find(x => x.id === roomId)
                if (!r) return ''
                const hours = (slotToMinutes(end) - slotToMinutes(start)) / 60
                return `${hours}h · ${money(hours * r.price_per_hour)}`
              }}
            />
            </>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => selectRoom(room)}
              // Hover is the earliest honest hint that somebody is about to
              // look through this room's photos. Touch has no hover, so the
              // first arrow tap warms them instead.
              onMouseEnter={() => warmPhotos(room)}
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
              {/* ── Room image / carousel ── set by admins, see the note above ── */}
              {(() => {
                const images = room.photo_urls
                const idx = carouselIndex[room.id] ?? 0
                return (
                  <div className="relative bg-gray-100 aspect-[16/10] overflow-hidden">
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
                              onClick={e => { e.stopPropagation(); warmPhotos(room); setCarouselIndex(p => ({ ...p, [room.id]: (idx - 1 + images.length) % images.length })) }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                            ><ChevronLeft size={15} /></button>
                            <button
                              onClick={e => { e.stopPropagation(); warmPhotos(room); setCarouselIndex(p => ({ ...p, [room.id]: (idx + 1) % images.length })) }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                            ><ChevronRight size={15} /></button>
                            {/* Above the name/price overlay, not behind it. */}
                            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                              {images.map((_, i) => (
                                <button key={i} onClick={e => { e.stopPropagation(); warmPhotos(room); setCarouselIndex(p => ({ ...p, [room.id]: i })) }}
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
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gray-900/85 via-gray-900/40 to-transparent pointer-events-none" />
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
                  <Collapse open={expandedRoom === room.id}>
                    <p className="text-sm text-gray-500 leading-relaxed mt-2">
                      {room.description}
                    </p>
                  </Collapse>
                </div>
              </div>
              )}
            </div>
          ))}
          </div>
          )}
          </div>

        </div>

        {/* ── Right: Sticky booking widget ─────────────────────────── */}
        {/* Sticky on the grid column itself (as on the day pass) — sticky on
            the inner card did nothing, since its wrapper was only as tall as
            the card. Desktop only; on phones it just stacks below the rooms. */}
        <div ref={widgetRef} className="lg:col-span-4 lg:sticky lg:top-6 scroll-mt-4 space-y-3">
          {/* The month, open on the page, beside the day. Which days this
              building takes bookings on at all was only discoverable by
              landing on one and reading a warning (Caroline, 2026-11-20). */}
          {view === 'calendar' && (
            <MonthPanel
              value={selectedDate}
              onChange={v => { setSelectedDate(v); setSelectedStart(''); setSelectedEnd('') }}
              maxDate={lastBookableDate()}
              dayUnavailable={d => dateUnavailableReason(d, closures, phone)}
            />
          )}
          <div className={cn(
            'bg-white rounded-xl overflow-hidden transition-all',
            selectedRoom
              ? 'ring-1 ring-booking-600/30 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-8px_rgba(16,24,40,0.12)]'
              : 'ring-1 ring-gray-200/80'
          )}>

            {!selectedRoom ? (
              <div className="px-5 py-6">
                <div className="text-sm font-semibold text-gray-900">Pick a room to see times</div>
                <p className="text-sm text-gray-500 mt-1">Click a photo, or choose one here. Whatever you can select is free.</p>
                <div className="mt-3">{roomPicker}</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Room summary: the dropdown names the room with its size and
                    price, and switches rooms without going back to the photos. */}
                <div className="px-5 py-4">
                  {roomPicker}
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
                          dayUnavailable={d => dateUnavailableReason(d, closures, phone) ?? (fullDays.has(d) ? 'Fully booked' : null)}
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
                        <a href={`tel:${phone.replace(/\D/g,'')}`}
                          className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900">
                          <Phone size={12} /> {phone}
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
                            disabled={!allDayPossible}
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

                        {/* The greyed switch is explanation enough. It
                            briefly carried a paragraph saying why a full
                            day cannot start part way through one; the
                            paragraph was more noise than the switch was
                            mystery (Caroline, 2026-11-20). */}
                        {loadingSlots ? (
                          <p className="text-sm text-gray-400">Loading availability…</p>
                        ) : (
                          <>
                        {/* The two halves of the All day switch open and
                            shut rather than swapping in place, so the panel
                            grows into the time pickers instead of jumping
                            (Caroline, 2026-11-18). Both stay in the page;
                            Collapse marks the shut one inert, so its selects
                            cannot be tabbed into. */}
                        {/* Only the good news here. When the day is not
                            free the panel below says so and offers the
                            calendar, and saying it twice, once in alarm
                            colours, made a solvable problem look like an
                            error (Caroline, 2026-11-19). */}
                        <Collapse open={allDay && !allDayBlocked} duration={220}>
                          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">9:00 AM – 5:00 PM</p>
                        </Collapse>
                        <Collapse open={!allDay} duration={220}>
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
                        </Collapse>
                          </>
                        )}
                      </div>

                      {/* ── Taken? Show them the day ─────────────────
                          This was a ranked list of other rooms. The grid
                          answers the same question better: instead of
                          being told three options it shows every room's
                          whole day, and they pick off it
                          (Caroline, 2026-11-19). */}
                      {/* Only while they are looking at the photos. On
                            the calendar they are already looking at every
                            room's day, so an invitation to go and look at
                            it is noise (Caroline, 2026-11-20). */}
                      <Collapse open={showSuggestions && view === 'rooms'}>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                          <p className="text-sm text-gray-700 m-0">
                            {noTimeLeft
                              ? `${selectedRoom.external_name} is booked all day.`
                              : `${selectedRoom.external_name} is booked for part of that day.`}
                          </p>
                          {/* Says what is on the other side of it. "View
                              full calendar" named the thing rather than
                              the answer, and the whole point here is that
                              the other rooms might be free
                              (Caroline, 2026-11-20). */}
                          <button
                            type="button"
                            onClick={() => {
                              setView('calendar')
                              gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-booking-700 hover:text-booking-800"
                          >
                            <CalendarDays size={14} />
                            View availability for all rooms
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </Collapse>

                      {/* Estimated total. Not while the selection cannot
                          be booked: pricing a day that is already taken
                          reads as an offer. */}
                      <Collapse open={durationHours > 0 && !allDayBlocked} duration={220}>
                        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-gray-500">{durationHours}h · ${selectedRoom.price_per_hour}/hr</span>
                          <span className="font-semibold text-gray-900">Est. {money(estimatedTotal)}</span>
                        </div>
                      </Collapse>
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
                      // Said "Request Booking" before, which reads as though a
                      // human reviews it and gets back to you. Nobody does: it
                      // is an instant paid booking. Since the button is dead
                      // until times are picked anyway, say what is missing
                      // (Caroline, 2026-10-01).
                      <button disabled
                        className="w-full bg-booking-200 text-white text-sm font-semibold py-3 rounded-lg cursor-not-allowed">
                        {selectedStart ? 'Select an end time' : 'Select a time'}
                      </button>
                    )}
                    {/* The policy where the money is. It was fine print
                        at the very bottom of the page, which is the one
                        place nobody about to pay is looking; the binding
                        version, with its tick box, is on the payment page
                        (Caroline, 2026-11-20). */}
                    {canContinue && (
                      <p className="mt-2.5 text-[11px] leading-snug text-gray-500 text-center">
                        Non-refundable. If you need to cancel we can usually
                        put the amount toward a future booking.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* After-hours note. Only on the rooms view: the calendar
                carries the same offer along its own five o'clock edge,
                and two of them on one screen is one too many. */}
            {view === 'rooms' && selectedRoom && !dateClosed && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-600">
                  Need outside 9 AM–5 PM Monday–Friday?{' '}
                  <a href={`tel:${phone.replace(/\D/g,'')}`} className="font-medium underline hover:text-gray-900">{phone}</a>
                  {' '}or{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline hover:text-gray-900">{CONTACT_EMAIL}</a>
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* No fine print. What was left of it, the booking window, is a
          rule the controls already keep: the month's arrow stops at the
          last bookable month and the days past it are greyed. A lone
          sentence under a rule across an empty page said it twice and
          looked like an offcut (Caroline, 2026-11-20). */}
    </div>
  )
}
