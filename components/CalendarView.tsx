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

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; roomId: string; startSlot: number }
  | { mode: 'view';   reservation: Reservation }

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
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 16 * slotHRef.current
      }
    }, 50)
  }, [selectedLocation, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

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

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
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
          </div>

          <div className="flex items-center gap-3">
            {/* Row-height zoom — laptop/desktop only, drag to fit more (or
                less) of the day on screen at once. */}
            <div className="hidden lg:flex items-center gap-1.5 text-gray-400" title="Zoom the calendar rows">
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
              <div className="flex items-center gap-1.5 text-sm bg-blue-100 border border-blue-300 rounded-lg px-3 py-1.5">
                <Clock size={14} className="text-blue-700" />
                <span className={cn('font-semibold', hoursRemaining <= 0 ? 'text-red-600' : 'text-blue-800')}>
                  {hoursRemaining.toFixed(1)} hours
                </span>
                <span className="text-blue-700">remaining for {format(selectedDate, 'MMMM yyyy')}</span>
              </div>
            )}

            {/* Mobile-only Make a Reservation button */}
            <button
              onClick={() => setModal({ mode: 'create', roomId: rooms[0]?.id ?? '', startSlot: 18 })}
              className="flex lg:hidden items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} />
              <span>Make a Reservation</span>
            </button>
          </div>
        </div>

        {/* Calendar grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin">
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
                    className="relative border-l border-gray-200 min-w-[160px] flex-1"
                    style={{ height: slotH * TOTAL_SLOTS }}
                  >
                    {/* Slot backgrounds / click targets */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                      <div
                        key={i}
                        onClick={() => handleSlotClick(room.id, i)}
                        style={{ top: i * slotH, height: slotH }}
                        className={cn(
                          'absolute inset-x-0 cursor-pointer hover:bg-blue-50 transition-colors',
                          i % 2 === 0 ? 'border-t border-gray-200' : 'border-t border-dashed border-gray-200'
                        )}
                      />
                    ))}

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

                      return (
                        <div
                          key={res.id}
                          onClick={e => { e.stopPropagation(); handleBookingClick(res) }}
                          style={{ top: top + 2, height: height - 4, position: 'absolute', left: 3, right: 3 }}
                          className={cn(
                            'rounded-md px-2 py-1 cursor-pointer z-10 overflow-hidden',
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
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      </div>

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

