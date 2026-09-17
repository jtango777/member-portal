'use client'

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { format, addDays, subDays, isToday, isBefore, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Lock, FileText, Plus, Users, Clock, Ban, X, ZoomOut, ZoomIn } from 'lucide-react'
import { Location, Room, Reservation, Profile, Company } from '@/types'
import { cn, formatTime, isSameDay, buildTimeOptions, parseTimeValue, calcHoursUsed, toPacificDate } from '@/lib/utils'
import ReservationModal from './ReservationModal'
import toast from 'react-hot-toast'

const TIME_OPTIONS = buildTimeOptions()

// Calendar constants
const START_HOUR = 0      // 12 AM (midnight)
const END_HOUR   = 24     // 12 AM (next day)
const TIME_W     = 64     // px for time label column
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2  // 30 slots

// Row height (px per 30-min slot) is user-adjustable on laptop/desktop via
// a drag slider, so more (or less) of the day fits on screen at once.
const DEFAULT_SLOT_H = 56
const MIN_SLOT_H     = 28
const MAX_SLOT_H     = 72
const SLOT_H_STORAGE_KEY = 'bizhaus-calendar-slot-height'

// Below this much pointer travel a press-and-release is still a click, not a
// drag — admins open the edit modal far more often than they reschedule, so
// the tiny wobble of a normal click must never turn into a move.
const DRAG_THRESHOLD_PX = 4

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; roomId: string; startSlot: number }
  | { mode: 'view';   reservation: Reservation }

// A reservation an admin is currently dragging. `origin*` is where it sat
// when the press started (what we snap back to on failure), `target*` is the
// snapped slot under the pointer right now.
type DragState = {
  res:          Reservation
  durSlots:     number
  // Pointer-to-top-edge distance at grab time, so the block keeps the same
  // spot under the finger instead of jumping its top edge to the pointer.
  grabOffsetY:  number
  downX:        number
  downY:        number
  originRoomId: string
  originSlot:   number
  targetRoomId: string
  targetSlot:   number
  pointerX:     number
  pointerY:     number
  moved:        boolean
}

type Props = {
  locations:         Location[]
  profile:           Profile
  company:           Company | null
  // Whose bookings the hour cap above is scoped to — a shared company pool,
  // or (when the member has no company) just this one person's own bookings.
  hourScope:         'company' | 'individual'
  hoursUsed:         number
  defaultLocationId: string | null
}

type MemberOption = { id: string; full_name: string; company_name: string; company_id: string | null; pending?: boolean; email?: string }

export default function CalendarView({ locations, profile, company, hourScope, hoursUsed, defaultLocationId }: Props) {
  const defaultLocation = locations.find(l => l.id === defaultLocationId) ?? locations[0]
  const [selectedLocation, setSelectedLocation] = useState<Location>(defaultLocation)
  const [selectedDate, setSelectedDate]         = useState<Date>(new Date())
  const [rooms, setRooms]                       = useState<Room[]>([])
  const [reservations, setReservations]         = useState<Reservation[]>([])
  // Mobile only — desktop always shows the day grid, navigated via the
  // sidebar's mini calendar. Phones/portrait tablets had no date nav at
  // all before this (the sidebar is lg:only), so mobile gets its own
  // Google-Calendar-style month view that taps through to a day.
  const [mobileView, setMobileView]             = useState<'month' | 'day'>('month')
  const [allMonthReservations, setAllMonthReservations] = useState<Reservation[]>([])
  const [usedHours, setUsedHours]               = useState(hoursUsed)
  const [loading, setLoading]                   = useState(false)
  const [modal, setModal]                       = useState<ModalState>({ mode: 'closed' })
  const [membersList, setMembersList]           = useState<MemberOption[]>([])
  const [showPicker, setShowPicker]             = useState(false)
  const [pickerMonth, setPickerMonth]           = useState(new Date())
  const [slotH, setSlotH]                       = useState(DEFAULT_SLOT_H)
  const [showSidebarForm, setShowSidebarForm]   = useState(false)
  const [sidebarRoomId, setSidebarRoomId]       = useState('')
  const [sidebarTitle, setSidebarTitle]         = useState('')
  const [sidebarNotes, setSidebarNotes]         = useState('')
  const [sidebarStartVal, setSidebarStartVal]   = useState('9:00')
  const [sidebarEndVal, setSidebarEndVal]       = useState('9:30')
  const [sidebarLoading, setSidebarLoading]     = useState(false)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const pickerRef  = useRef<HTMLDivElement>(null)
  // Whatever time-of-day was centered in view right before a zoom change,
  // expressed independent of pixel height (scrollTop / old slotH) — so it
  // can be re-applied against the new slotH once the grid re-renders,
  // keeping the same moment in the day centered instead of the view
  // jumping around as row heights change.
  const pendingCenterRef = useRef<number | null>(null)
  // Mirrors slotH for code that runs on a delay (fetchData's setTimeout
  // below) and would otherwise read a stale value captured in an older
  // closure — kept in sync via the effect right under it.
  const slotHRef = useRef(slotH)
  useEffect(() => { slotHRef.current = slotH }, [slotH])

  // Remember the zoom level across visits — read after mount, not during
  // the initial render, so server-rendered HTML and the client's first
  // render always agree (reading localStorage during render would disagree
  // with the server, which has no localStorage, and break hydration).
  useEffect(() => {
    const saved = Number(localStorage.getItem(SLOT_H_STORAGE_KEY))
    if (saved && saved >= MIN_SLOT_H && saved <= MAX_SLOT_H) setSlotH(saved)
  }, [])

  function handleSlotHChange(value: number) {
    const el = scrollRef.current
    if (el) pendingCenterRef.current = (el.scrollTop + el.clientHeight / 2) / slotH
    setSlotH(value)
    localStorage.setItem(SLOT_H_STORAGE_KEY, String(value))
  }

  // Re-center after the grid re-renders at the new row height — must run
  // before the browser paints (useLayoutEffect, not useEffect), or there's
  // a visible flash of the unscrolled layout on every drag step before the
  // correction lands, which reads as the calendar jumping around instead
  // of staying centered.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (pendingCenterRef.current == null || !el) return
    el.scrollTop = pendingCenterRef.current * slotH - el.clientHeight / 2
    pendingCenterRef.current = null
  }, [slotH])

  // Pinch-to-zoom on the day grid (mobile) — reuses the same slotH the
  // desktop drag-slider drives, so it's one zoom mechanism either way.
  // Native listeners with { passive: false } because a two-finger pinch
  // needs preventDefault() (to stop the page itself from zooming), and
  // React's synthetic touch handlers can't reliably get a non-passive
  // listener registered in time. Single-finger scrolling is left alone —
  // preventDefault only fires when a second touch is actually down.
  const pinchStartDistRef  = useRef<number | null>(null)
  const pinchStartSlotHRef = useRef(DEFAULT_SLOT_H)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function distance(touches: TouchList) {
      const [a, b] = [touches[0], touches[1]]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return
      pinchStartDistRef.current = distance(e.touches)
      pinchStartSlotHRef.current = slotHRef.current
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2 || pinchStartDistRef.current == null) return
      e.preventDefault()
      const ratio = distance(e.touches) / pinchStartDistRef.current
      const next = Math.min(MAX_SLOT_H, Math.max(MIN_SLOT_H, Math.round(pinchStartSlotHRef.current * ratio)))
      handleSlotHChange(next)
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchStartDistRef.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const [roomsRes, resRes] = await Promise.all([
      fetch(`/api/rooms?locationId=${selectedLocation.id}`),
      fetch(`/api/reservations?locationId=${selectedLocation.id}&date=${dateStr}`),
    ])
    const [roomsData, resData] = await Promise.all([roomsRes.json(), resRes.json()])
    setRooms(roomsData)
    setReservations(resData)
    setLoading(false)
    setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      // Opens with 8am at the top of the grid, for every date including
      // today — the start of the business day is where people look first.
      // Changed 2026-09-14: it used to center on the current time for
      // today and on 8am for other dates, which meant 8am landed mid-screen
      // and early bookings started partly scrolled out of view. The small
      // offset keeps the "8am" label itself visible instead of clipped.
      const EIGHT_AM_SLOT = (8 - START_HOUR) * 2
      el.scrollTop = Math.max(0, EIGHT_AM_SLOT * slotHRef.current - 8)
    }, 50)
  }, [selectedLocation, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  // Feeds the mobile month view's per-day booking bars. Fetched by month
  // (not just the currently selected day) so every cell in the grid can
  // show what's booked, not just the one day the desktop view cares about.
  useEffect(() => {
    const monthStr = format(pickerMonth, 'yyyy-MM')
    fetch(`/api/reservations?locationId=${selectedLocation.id}&month=${monthStr}`)
      .then(r => r.json())
      .then(setAllMonthReservations)
      .catch(() => setAllMonthReservations([]))
  }, [selectedLocation, pickerMonth])

  function getReservationsForDay(day: Date) {
    return allMonthReservations.filter(r => isSameDay(toPacificDate(new Date(r.start_time)), day))
  }

  // Fetch members list for admin booking on behalf
  useEffect(() => {
    if (!profile.is_admin) return
    fetch('/api/admin/members/registered')
      .then(r => r.json())
      .then((data: any[]) => setMembersList(data))
      .catch(() => {})
  }, [profile.is_admin])

  // Recalculate hours used from month reservations whenever selectedDate month changes
  useEffect(() => {
    if (!company || profile.is_admin) return
    const month = selectedDate.getMonth()
    const year = selectedDate.getFullYear()
    fetch(`/api/reservations/month-hours?month=${year}-${String(month + 1).padStart(2, '0')}&scope=${hourScope}&id=${company.id}`)
      .then(r => r.json())
      .then((data: any) => {
        if (typeof data.hours === 'number') setUsedHours(data.hours)
      })
      .catch(() => {})
  }, [selectedDate, company, hourScope, profile.is_admin, reservations])


  function slotToTime(slot: number): Date {
    const h = START_HOUR + Math.floor(slot / 2)
    const m = slot % 2 === 0 ? 0 : 30
    const d = new Date(selectedDate)
    d.setHours(h, m, 0, 0)
    return d
  }

  function timeToSlot(dateStr: string): number {
    const d = toPacificDate(new Date(dateStr))
    return (d.getHours() - START_HOUR) * 2 + Math.floor(d.getMinutes() / 30)
  }

  function getReservationsForRoom(roomId: string) {
    return reservations.filter(r => r.room_id === roomId)
  }

  function handleSlotClick(roomId: string, slot: number) {
    setModal({ mode: 'create', roomId, startSlot: slot })
  }

  function handleBookingClick(res: Reservation) {
    setModal({ mode: 'view', reservation: res })
  }

  // ── Admin drag-to-reschedule ──────────────────────────────────────────
  // Admins move a booking to another time or room by dragging its block.
  // Members never get this: their edit path stays the modal, which is where
  // the 12-hour window and hour-allotment warnings live.
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  // Room column elements, measured live on every pointermove — the columns
  // are `flex-1` inside a horizontally scrolling container, so their width
  // and left edge depend on the room count and the scroll position and can't
  // be computed from constants.
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Set on a drag that actually moved, so the click React fires right after
  // pointerup doesn't also pop the edit modal on top of the move.
  const suppressClickRef = useRef(false)
  // Read inside the window-level pointer handlers, which are registered once
  // per drag and would otherwise see the reservation list as it was when the
  // drag began.
  const reservationsRef = useRef(reservations)
  useEffect(() => { reservationsRef.current = reservations }, [reservations])

  function setDragState(next: DragState | null) {
    dragRef.current = next
    setDrag(next)
  }

  function slotsFree(roomId: string, startSlot: number, durSlots: number, ignoreId: string) {
    const endSlot = startSlot + durSlots
    return !reservationsRef.current.some(r =>
      r.room_id === roomId &&
      r.id !== ignoreId &&
      timeToSlot(r.start_time) < endSlot &&
      timeToSlot(r.end_time) > startSlot
    )
  }

  function handleBlockPointerDown(e: React.PointerEvent, res: Reservation, roomId: string) {
    if (!profile.is_admin || e.button !== 0) return
    const col = colRefs.current[roomId]
    if (!col) return
    const startSlot = Math.max(0, timeToSlot(res.start_time))
    const endSlot   = Math.min(TOTAL_SLOTS, timeToSlot(res.end_time))
    // Sub-slot bookings still render a half-slot tall, so a minimum of one
    // slot keeps the ghost the same size as the block it represents.
    const durSlots  = Math.max(1, endSlot - startSlot)
    suppressClickRef.current = false
    // Stops the browser from starting a text selection or a native image
    // drag, either of which swallows the pointermove stream mid-gesture.
    e.preventDefault()
    setDragState({
      res,
      durSlots,
      grabOffsetY:  e.clientY - (col.getBoundingClientRect().top + startSlot * slotH),
      downX:        e.clientX,
      downY:        e.clientY,
      originRoomId: roomId,
      originSlot:   startSlot,
      targetRoomId: roomId,
      targetSlot:   startSlot,
      pointerX:     e.clientX,
      pointerY:     e.clientY,
      moved:        false,
    })
  }

  const dragging = drag !== null

  // Listeners go on the window rather than the block so the gesture survives
  // the pointer leaving the block (which it does immediately — the block
  // stays put while the ghost follows) or leaving the grid entirely.
  useEffect(() => {
    if (!dragging) return

    function onMove(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      // Keep the last valid column when the pointer strays over the time
      // gutter or past the last room, instead of snapping back to the origin.
      let targetRoomId = d.targetRoomId
      for (const room of rooms) {
        const el = colRefs.current[room.id]
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX < r.right) { targetRoomId = room.id; break }
      }
      const col = colRefs.current[targetRoomId]
      if (!col) return
      const topPx = e.clientY - d.grabOffsetY - col.getBoundingClientRect().top
      const targetSlot = Math.min(
        TOTAL_SLOTS - d.durSlots,
        Math.max(0, Math.round(topPx / slotHRef.current))
      )
      setDragState({
        ...d,
        targetRoomId,
        targetSlot,
        pointerX: e.clientX,
        pointerY: e.clientY,
        moved: d.moved || Math.hypot(e.clientX - d.downX, e.clientY - d.downY) > DRAG_THRESHOLD_PX,
      })
    }

    function onUp() {
      const d = dragRef.current
      setDragState(null)
      if (!d) return
      if (!d.moved) return           // a plain click — the onClick handler opens the modal
      suppressClickRef.current = true
      if (d.targetRoomId === d.originRoomId && d.targetSlot === d.originSlot) return
      if (!slotsFree(d.targetRoomId, d.targetSlot, d.durSlots, d.res.id)) {
        toast.error('That time overlaps another booking in that room')
        return
      }
      moveReservation(d)
    }

    function onCancel() {
      // A cancelled pointer (OS gesture, pen lift, alt-tab) is an abandoned
      // drag, not a drop — leave the booking where it was.
      setDragState(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [dragging, rooms])

  async function moveReservation(d: DragState) {
    const start = slotToTime(d.targetSlot)
    const end   = slotToTime(d.targetSlot + d.durSlots)
    const before = reservationsRef.current
    // Optimistic: the block lands where it was dropped straight away, and
    // only snaps back if the server refuses (conflict, hour cap, edit window).
    setReservations(rs => rs.map(r => r.id === d.res.id
      ? { ...r, room_id: d.targetRoomId, start_time: start.toISOString(), end_time: end.toISOString() }
      : r
    ))

    const res = await fetch(`/api/reservations/${d.res.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // title/notes ride along unchanged — the route writes every field in
      // the payload, so omitting them would blank them out.
      body: JSON.stringify({
        room_id:    d.targetRoomId,
        title:      d.res.title,
        notes:      d.res.notes ?? null,
        start_time: start.toISOString(),
        end_time:   end.toISOString(),
      }),
    })

    if (res.ok) {
      // A recurring booking is stored as one row per occurrence, so a drag
      // only ever moves the one you grabbed — say so, or an admin will assume
      // the whole series followed.
      toast.success(d.res.recurrence_group_id
        ? 'Reservation moved — this occurrence only'
        : 'Reservation moved')
      fetchData()
      return
    }

    setReservations(before)
    const data = await res.json().catch(() => ({} as any))
    // Admins get a machine-readable 'conflict' plus the clashing bookings so
    // the modal can offer to override; a drag has nowhere to show that, so
    // it just says what happened.
    toast.error(data.error === 'conflict'
      ? 'That room is already booked for that time.'
      : data.error ?? 'Could not move this reservation')
  }

  function handleModalClose(refresh?: boolean) {
    setModal({ mode: 'closed' })
    if (refresh) fetchData()
  }

  function openSidebarForm(roomId?: string, startSlot?: number) {
    setSidebarRoomId(roomId ?? rooms[0]?.id ?? '')
    setSidebarTitle('')
    setSidebarNotes('')
    const sv = startSlot !== undefined
      ? `${START_HOUR + Math.floor(startSlot / 2)}:${startSlot % 2 === 0 ? '00' : '30'}`
      : '9:00'
    setSidebarStartVal(sv)
    const [sh, sm] = sv.split(':').map(Number)
    const em = sh * 60 + sm + 30
    setSidebarEndVal(`${Math.floor(em / 60)}:${em % 60 === 0 ? '00' : '30'}`)
    setShowSidebarForm(true)
  }

  async function handleSidebarSave() {
    if (!sidebarTitle.trim()) { toast.error('Please enter a title'); return }
    const startDate = parseTimeValue(format(selectedDate, 'yyyy-MM-dd'), sidebarStartVal)
    const endDate = parseTimeValue(format(selectedDate, 'yyyy-MM-dd'), sidebarEndVal)
    if (endDate <= startDate) { toast.error('End time must be after start time'); return }

    const durationHrs = (endDate.getTime() - startDate.getTime()) / 3600000
    if (!profile.is_admin && company) {
      const remaining = company.monthly_hours_allotment - usedHours
      if (durationHrs > remaining) { toast.error('Not enough hours remaining this month'); return }
    }

    setSidebarLoading(true)
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: sidebarRoomId,
        title: sidebarTitle.trim(),
        notes: sidebarNotes.trim() || null,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        formatted_date: format(selectedDate, 'EEEE, MMMM d, yyyy'),
        formatted_time: `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`,
      }),
    })
    if (res.ok) {
      toast.success('Reservation created')
      setShowSidebarForm(false)
      fetchData()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Something went wrong')
    }
    setSidebarLoading(false)
  }

  const sidebarEndOptions = TIME_OPTIONS.filter(opt => {
    const [h, m] = opt.value.split(':').map(Number)
    const [sh, sm] = sidebarStartVal.split(':').map(Number)
    return h > sh || (h === sh && m > sm)
  })

  const hoursRemaining = company ? company.monthly_hours_allotment - usedHours : null

  // Shared between the desktop sidebar and the mobile date popover — was
  // only ever built once, inline in the sidebar, which is hidden below
  // `lg`. That left phones and portrait tablets with no way to change the
  // day at all (caught 2026-09-11).
  function MiniCalendar() {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setPickerMonth(m => subMonths(m, 1))} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-gray-900">{format(pickerMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setPickerMonth(m => addMonths(m, 1))} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: getDay(startOfMonth(pickerMonth)) }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {eachDayOfInterval({ start: startOfMonth(pickerMonth), end: endOfMonth(pickerMonth) }).map(day => {
            const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'text-center text-xs py-1.5 rounded-md transition-colors',
                  isSameDay(day, selectedDate)
                    ? 'bg-blue-600 text-white font-semibold'
                    : isToday(day)
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : isPast
                    ? 'text-gray-400 hover:bg-gray-100'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white">
      {/* ── Left sidebar ── */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 p-4 space-y-4 overflow-y-auto hidden lg:block">
        {/* Date heading */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{format(selectedDate, 'MMMM d, yyyy')}</p>
          {!isToday(selectedDate) && (
            <button onClick={() => setSelectedDate(new Date())}
              className="text-xs text-blue-600 font-medium hover:text-blue-800">Today</button>
          )}
        </div>

        {/* Mini calendar */}
        <MiniCalendar />

        {/* Make a Reservation button */}
        <button
          onClick={() => setModal({ mode: 'create', roomId: rooms[0]?.id ?? '', startSlot: 18 })}
          className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Make a Reservation
        </button>

      </div>

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top bar — separate desktop/mobile layouts, not just wrapping
            the same row. Desktop keeps Location and the hours pill side by
            side (there's room). Mobile merges them into one pill (Location
            left, hours right) and puts Make a Reservation on its own
            full-width row below — the wrapped version was better than the
            original overflow, but the button still landed on a lonely
            second line at an awkward width. Caught 2026-09-11. */}
        <div className="border-b border-gray-200 flex-shrink-0">
          {/* Desktop */}
          <div className="hidden lg:flex items-center justify-between gap-2 px-4 py-3">
            <div className="flex items-center gap-1.5 bg-blue-100 border border-blue-300 rounded-lg px-3 py-1.5">
              <span className="text-sm font-medium text-gray-500">Location:</span>
              <select
                value={selectedLocation.id}
                onChange={e => {
                  const loc = locations.find(l => l.id === e.target.value)
                  if (loc) setSelectedLocation(loc)
                }}
                className="text-sm font-semibold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              {/* Row-height zoom — drag to fit more (or less) of the day
                  on screen at once. */}
              <div className="flex items-center gap-1.5 text-gray-400" title="Zoom the calendar rows">
                <ZoomOut size={14} />
                <input
                  type="range"
                  min={MIN_SLOT_H}
                  max={MAX_SLOT_H}
                  step={4}
                  value={slotH}
                  onChange={e => handleSlotHChange(Number(e.target.value))}
                  className="w-24 accent-blue-600 cursor-pointer"
                  aria-label="Calendar row height"
                />
                <ZoomIn size={14} />
              </div>

              {company && !profile.is_admin && hoursRemaining !== null && (
                <div className="flex items-center gap-1.5 text-sm bg-blue-100 border border-blue-300 rounded-lg px-3 py-1.5 whitespace-nowrap">
                  <Clock size={14} className="text-blue-700 flex-shrink-0" />
                  <span className={cn('font-semibold', hoursRemaining <= 0 ? 'text-red-600' : 'text-blue-800')}>
                    {hoursRemaining.toFixed(1)} hours
                  </span>
                  <span className="text-blue-700">remaining for {format(selectedDate, 'MMMM yyyy')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mobile */}
          <div className="flex lg:hidden flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-2 bg-blue-100 border border-blue-300 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-gray-500 flex-shrink-0">Location:</span>
                <select
                  value={selectedLocation.id}
                  onChange={e => {
                    const loc = locations.find(l => l.id === e.target.value)
                    if (loc) setSelectedLocation(loc)
                  }}
                  className="text-sm font-semibold text-blue-700 bg-transparent focus:outline-none cursor-pointer min-w-0"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              {company && !profile.is_admin && hoursRemaining !== null && (
                <div className="flex items-center gap-1 text-sm flex-shrink-0 whitespace-nowrap">
                  <Clock size={14} className="text-blue-700 flex-shrink-0" />
                  <span className={cn('font-semibold', hoursRemaining <= 0 ? 'text-red-600' : 'text-blue-800')}>
                    {hoursRemaining.toFixed(1)}h
                  </span>
                  <span className="text-blue-700">left</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setModal({ mode: 'create', roomId: rooms[0]?.id ?? '', startSlot: 18 })}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              <Plus size={16} />
              <span>Make a Reservation</span>
            </button>
          </div>
        </div>

        {/* Mobile date nav — month view browses by month; day view (after
            tapping a date) browses by day and can hop back to the month.
            Desktop doesn't need this row at all, it has the sidebar. */}
        <div className="flex lg:hidden items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          {mobileView === 'day' ? (
            <>
              <button onClick={() => setMobileView('month')}
                className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
                <ChevronLeft size={16} /> Month
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDate(d => subDays(d, 1))} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-gray-900 min-w-[7.5rem] text-center">
                  {format(selectedDate, 'EEE, MMM d')}
                </span>
                <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronRight size={16} />
                </button>
              </div>
              {!isToday(selectedDate) ? (
                <button onClick={() => setSelectedDate(new Date())} className="text-xs text-blue-600 font-medium">Today</button>
              ) : <span className="w-10" />}
            </>
          ) : (
            <>
              <button onClick={() => setPickerMonth(m => subMonths(m, 1))} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-900">{format(pickerMonth, 'MMMM yyyy')}</span>
              <button onClick={() => setPickerMonth(m => addMonths(m, 1))} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>

        {/* Mobile month view — Google-Calendar-style: each cell shows up to
            3 small colored bars (truncated title, same own/block/other
            coloring the day grid below uses) and a "+N more" overflow.
            Tapping a day jumps into the day view for that date. */}
        {mobileView === 'month' && (
          <div className="lg:hidden flex-1 overflow-auto">
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-400 font-medium py-1.5">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: getDay(startOfMonth(pickerMonth)) }).map((_, i) => (
                <div key={`pad-${i}`} className="border-r border-b border-gray-100 min-h-[76px]" />
              ))}
              {eachDayOfInterval({ start: startOfMonth(pickerMonth), end: endOfMonth(pickerMonth) }).map(day => {
                const dayReservations = getReservationsForDay(day)
                const shown = dayReservations.slice(0, 3)
                const overflow = dayReservations.length - shown.length
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setSelectedDate(day); setMobileView('day') }}
                    className="border-r border-b border-gray-100 min-h-[76px] p-1 flex flex-col items-stretch text-left"
                  >
                    <span className={cn(
                      'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 self-start',
                      isSameDay(day, selectedDate) ? 'bg-blue-600 text-white' : isToday(day) ? 'text-blue-600' : 'text-gray-700'
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      {shown.map(res => {
                        const isOwn = res.user_id === profile.id || (!!profile.company_id && res.company_id === profile.company_id)
                        const isBlock = res.is_admin_block
                        return (
                          <div key={res.id} className={cn(
                            'text-[10px] leading-tight px-1 py-[1px] rounded truncate',
                            isBlock ? 'bg-slate-200 text-slate-700' : isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                          )}>
                            {res.title}
                          </div>
                        )
                      })}
                      {overflow > 0 && (
                        <div className="text-[10px] text-gray-400 px-1">+{overflow} more</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Calendar grid (day view) — always shown on desktop; on mobile
            only once a day's been tapped from the month view above. */}
      <div ref={scrollRef} className={cn(
        mobileView === 'day' ? 'block' : 'hidden',
        'lg:block flex-1 overflow-auto scrollbar-thin'
      )}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="min-w-max">
            {/* Room header row */}
            <div
              className="sticky top-0 z-20 bg-white border-b border-gray-200 flex"
              style={{ paddingLeft: TIME_W }}
            >
              {rooms.map(room => (
                <div
                  key={room.id}
                  className="border-l border-gray-200 px-3 py-2 min-w-[160px] flex-1"
                >
                  <div className="font-semibold text-sm text-gray-900 leading-tight" title={room.name}>{room.name}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Users size={10} />
                    {room.capacity}
                  </div>
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div className="flex">
              {/* Time labels */}
              <div className="flex-none" style={{ width: TIME_W }}>
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
                  const hour = START_HOUR + Math.floor(i / 2)
                  const isHour = i % 2 === 0
                  return (
                    <div
                      key={i}
                      style={{ height: slotH }}
                      className="flex items-start justify-end pr-2 pt-1"
                    >
                      {isHour && (
                        <span className="text-xs text-gray-400 font-medium">
                          {hour === 0 ? '12am' : hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Room columns */}
              {rooms.map(room => {
                const roomReservations = getReservationsForRoom(room.id)
                return (
                  <div
                    key={room.id}
                    ref={el => { colRefs.current[room.id] = el }}
                    className="relative border-l border-gray-200 min-w-[160px] flex-1"
                    style={{ height: slotH * TOTAL_SLOTS }}
                  >
                    {/* Slot backgrounds / click targets. Members can't book
                        an already-passed slot on today's date — clicking
                        used to open a fresh "create" modal for it same as
                        any other slot, so a member could book (and burn
                        hours on) a time that had already happened, with no
                        way to cancel it afterward since it was instantly
                        "in the past". Admins are exempt (same as the
                        server-side check) since they may need to log
                        something after the fact. */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
                      const isPastSlot = !profile.is_admin && isToday(selectedDate) && isBefore(slotToTime(i), new Date())
                      return (
                        <div
                          key={i}
                          onClick={() => { if (!isPastSlot) handleSlotClick(room.id, i) }}
                          style={{ top: i * slotH, height: slotH }}
                          title={isPastSlot ? "This time has already passed" : undefined}
                          className={cn(
                            'absolute inset-x-0 transition-colors',
                            i % 2 === 0 ? 'border-t border-gray-200' : 'border-t border-dashed border-gray-200',
                            isPastSlot ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'
                          )}
                        />
                      )
                    })}

                    {/* Booking cards */}
                    {roomReservations.map(res => {
                      const startSlot  = Math.max(0, timeToSlot(res.start_time))
                      const endSlot    = Math.min(TOTAL_SLOTS, timeToSlot(res.end_time))
                      const top        = startSlot * slotH
                      const height     = Math.max(slotH / 2, (endSlot - startSlot) * slotH)
                      // "Own" (blue) covers both bookings this person made
                      // themselves and any booking under their company —
                      // it's their company's hours either way, so it reads
                      // as theirs on the calendar too.
                      const isOwn      = res.user_id === profile.id
                        || (!!profile.company_id && res.company_id === profile.company_id)
                      const isBlock    = res.is_admin_block

                      const isDragged = drag?.res.id === res.id && drag.moved

                      return (
                        <div
                          key={res.id}
                          onClick={e => {
                            e.stopPropagation()
                            // Swallow the click the browser fires after a
                            // completed drag — the move already happened.
                            if (suppressClickRef.current) { suppressClickRef.current = false; return }
                            handleBookingClick(res)
                          }}
                          onPointerDown={e => handleBlockPointerDown(e, res, room.id)}
                          style={{
                            top: top + 2, height: height - 4, position: 'absolute', left: 3, right: 3,
                            // Only admins drag, and only they need the browser
                            // to stop treating a press on a block as the start
                            // of a touch scroll.
                            touchAction: profile.is_admin ? 'none' : undefined,
                          }}
                          className={cn(
                            'rounded-md px-2 py-1 z-10 overflow-hidden',
                            profile.is_admin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            // The original fades while its ghost is out under
                            // the pointer, so it's obvious which one is live.
                            isDragged && 'opacity-40',
                            // Only the hover dim should animate — top/height
                            // are driven by the zoom slider and must snap
                            // instantly with the rest of the grid, or the
                            // card visibly glides out of sync with the grid
                            // lines and scroll position on every resize.
                            'transition-[filter] hover:brightness-95 select-none',
                            isBlock
                              ? 'bg-slate-200 text-slate-600 border border-slate-300'
                              : isOwn
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          )}
                        >
                          <div className="flex items-center gap-1 text-xs font-medium opacity-90">
                            {isBlock
                              ? <Ban size={10} className="flex-shrink-0" />
                              : <Lock size={10} className="flex-shrink-0" />
                            }
                            <span className="truncate">
                              {formatTime(toPacificDate(new Date(res.start_time)))} – {formatTime(toPacificDate(new Date(res.end_time)))}
                            </span>
                            {!isBlock && res.notes && <FileText size={10} className="flex-shrink-0 ml-auto" />}
                          </div>
                          {height >= slotH && (
                            <>
                              <div className="font-semibold text-sm truncate mt-0.5 leading-tight">
                                {res.title}
                              </div>
                              {!isBlock && (
                                <div className="text-xs opacity-75 truncate">
                                  {res.profiles?.full_name}
                                  {res.companies?.name ? ` · ${res.companies.name}` : ''}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}

                    {/* Drop preview. Blue outline = the slot is free; grey
                        hatch = it would overlap something in this room. Red
                        is deliberately not used here — it's reserved for a
                        move the server actually rejected. */}
                    {drag && drag.moved && drag.targetRoomId === room.id && (() => {
                      const free = slotsFree(room.id, drag.targetSlot, drag.durSlots, drag.res.id)
                      return (
                        <div
                          style={{
                            top: drag.targetSlot * slotH + 2,
                            height: drag.durSlots * slotH - 4,
                            position: 'absolute', left: 3, right: 3,
                            backgroundImage: free
                              ? undefined
                              : 'repeating-linear-gradient(45deg, rgba(100,116,139,0.28) 0 5px, transparent 5px 10px)',
                          }}
                          className={cn(
                            'rounded-md border-2 z-30 pointer-events-none',
                            free
                              ? 'border-blue-600 bg-blue-500/15'
                              : 'border-gray-400 bg-gray-200/80 cursor-not-allowed'
                          )}
                        />
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      </div>

      {/* Prospective time/room readout that trails the pointer during a drag.
          Fixed and rendered at the root, not inside a column, because the
          grid scrolls in both directions and would otherwise clip it. */}
      {drag && drag.moved && (
        <div
          style={{ position: 'fixed', left: drag.pointerX + 14, top: drag.pointerY + 14, zIndex: 60 }}
          className="pointer-events-none rounded-md bg-gray-900/90 text-white text-xs font-medium px-2 py-1 shadow-sm whitespace-nowrap"
        >
          {formatTime(slotToTime(drag.targetSlot))} – {formatTime(slotToTime(drag.targetSlot + drag.durSlots))}
          {' · '}
          {rooms.find(r => r.id === drag.targetRoomId)?.name}
        </div>
      )}

      {/* Modal (for viewing/editing existing reservations) */}
      {modal.mode !== 'closed' && (
        <ReservationModal
          mode={modal.mode}
          reservation={modal.mode === 'view' ? modal.reservation : undefined}
          initialRoomId={modal.mode === 'create' ? modal.roomId : undefined}
          initialSlot={modal.mode === 'create' ? modal.startSlot : undefined}
          selectedDate={selectedDate}
          rooms={rooms}
          profile={profile}
          company={company}
          hoursUsed={usedHours}
          members={profile.is_admin ? membersList : undefined}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

