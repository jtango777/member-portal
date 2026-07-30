'use client'

import { useState, useEffect } from 'react'
import { format, addDays, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, isToday } from 'date-fns'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Lock, Trash2, Edit2, Check, AlertCircle, Repeat, Ban, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import MiniDatePicker from './MiniDatePicker'
import { Reservation, Room, Profile, Company } from '@/types'
import { cn, buildTimeOptions, parseTimeValue, formatTime, isSameDay, toPacificDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const START_HOUR = 0
const TIME_OPTIONS = buildTimeOptions()

const DAYS = [
  { label: 'S', day: 0 }, { label: 'M', day: 1 }, { label: 'T', day: 2 },
  { label: 'W', day: 3 }, { label: 'T', day: 4 }, { label: 'F', day: 5 }, { label: 'S', day: 6 },
]

type MemberOption = { id: string; full_name: string; company_name: string; company_id: string }

type Props = {
  mode: 'create' | 'view'
  reservation?: Reservation
  initialRoomId?: string
  initialSlot?: number
  selectedDate: Date
  rooms: Room[]
  profile: Profile
  company: Company | null
  hoursUsed: number
  members?: MemberOption[]
  onClose: (refresh?: boolean) => void
}

type ConflictItem = {
  id: string
  title: string
  start_time: string
  end_time: string
  booked_by: string
  company: string
}

function slotToTimeValue(slot: number): string {
  const h = START_HOUR + Math.floor(slot / 2)
  const m = slot % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
}

function parseFuzzyDate(input: string): Date | null {
  const s = input.trim()
  if (!s) return null
  const thisYear = new Date().getFullYear()
  function resolveYear(raw: string | undefined): number {
    if (!raw) return thisYear
    const n = parseInt(raw)
    return raw.length <= 2 ? 2000 + n : n
  }

  // Numeric with / or - or . separators: 6/24/2026, 06-24-26, 6.24, etc.
  const numMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/)
  if (numMatch) {
    const date = new Date(resolveYear(numMatch[3]), parseInt(numMatch[1]) - 1, parseInt(numMatch[2]))
    if (!isNaN(date.getTime())) return date
  }

  // Word month: "June 24, 2026", "Jun 24 26", "June 24", "Jun 24, 2026", etc.
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const abbrevs = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const wordMatch = s.match(/^([a-zA-Z]+)\.?\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?$/)
  if (wordMatch) {
    const name = wordMatch[1].toLowerCase()
    const mi = months.indexOf(name) !== -1 ? months.indexOf(name) : abbrevs.indexOf(name)
    if (mi >= 0) {
      const date = new Date(resolveYear(wordMatch[3]), mi, parseInt(wordMatch[2]))
      if (!isNaN(date.getTime())) return date
    }
  }

  return null
}

// Centers the modal within the visible content area (to the right of the nav
// sidebar and any page-specific left-hand panels, e.g. the mini calendar on
// the Rooms page), rather than the full browser viewport. We measure the
// actual rendered content region via the DOM instead of relying on a global
// CSS variable + calc(), since that approach can't account for page-specific
// chrome and is prone to drifting out of sync when panels resize.
function useModalCenterX(): number | null {
  const [centerX, setCenterX] = useState<number | null>(null)

  useEffect(() => {
    function findAnchor(): HTMLElement | null {
      return (
        document.querySelector<HTMLElement>('[data-modal-anchor]') ??
        document.querySelector<HTMLElement>('[data-dashboard-main]')
      )
    }

    function measure() {
      const anchor = findAnchor()
      if (!anchor) { setCenterX(null); return }
      const rect = anchor.getBoundingClientRect()
      setCenterX(rect.left + rect.width / 2)
    }

    measure()
    window.addEventListener('resize', measure)

    let ro: ResizeObserver | undefined
    const anchor = findAnchor()
    if (anchor && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(anchor)
    }

    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  return centerX
}

function defaultRecurEndDate(from: Date): string {
  const d = addMonths(from, 3)
  return format(d, 'yyyy-MM-dd')
}

function generateOccurrences(
  baseStart: Date,
  baseEnd: Date,
  freq: 'daily' | 'weekly' | 'monthly',
  daysOfWeek: number[],
  endType: 'date' | 'count',
  endDateStr: string,
  endCount: number,
): Array<{ start_time: string; end_time: string }> {
  const results: Array<{ start_time: string; end_time: string }> = []
  const durationMs = baseEnd.getTime() - baseStart.getTime()
  if (durationMs <= 0) return results

  const baseHour = baseStart.getHours()
  const baseMinute = baseStart.getMinutes()

  const maxDate   = endType === 'date' && endDateStr ? new Date(endDateStr + 'T23:59:59') : null
  const maxCount  = endType === 'count' ? Math.min(endCount, 365) : 500

  function push(candidateDate: Date): boolean {
    const start = new Date(candidateDate.getFullYear(), candidateDate.getMonth(), candidateDate.getDate(), baseHour, baseMinute, 0, 0)
    const end = new Date(start.getTime() + durationMs)
    if (results.length >= maxCount) return false
    if (maxDate && start > maxDate) return false
    results.push({ start_time: start.toISOString(), end_time: end.toISOString() })
    return true
  }

  if (freq === 'daily') {
    let cur = new Date(baseStart)
    while (push(new Date(cur))) cur = addDays(cur, 1)

  } else if (freq === 'weekly') {
    const activeDays = (daysOfWeek.length > 0 ? [...daysOfWeek] : [baseStart.getDay()]).sort((a, b) => a - b)
    let weekSunday = new Date(baseStart)
    weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay())
    weekSunday.setHours(0, 0, 0, 0)

    outer: while (true) {
      for (const dow of activeDays) {
        const candidate = new Date(weekSunday)
        candidate.setDate(weekSunday.getDate() + dow)
        // Compare candidate date with baseStart date (candidate has no time set yet, push() adds time)
        const candidateWithTime = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate(), baseHour, baseMinute, 0, 0)
        if (candidateWithTime < baseStart) continue
        if (!push(candidate)) break outer
      }
      weekSunday = addDays(weekSunday, 7)
      if (maxDate && weekSunday > addDays(maxDate, 7)) break
    }

  } else if (freq === 'monthly') {
    let cur = new Date(baseStart)
    while (push(new Date(cur))) cur = addMonths(cur, 1)
  }

  return results
}

export default function ReservationModal({
  mode, reservation, initialRoomId, initialSlot, selectedDate,
  rooms, profile, company, hoursUsed, members, onClose
}: Props) {
  const [editing, setEditing]     = useState(mode === 'create')
  const [dateVal, setDateVal]     = useState(format(selectedDate, 'yyyy-MM-dd'))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerMonth, setDatePickerMonth] = useState(new Date(format(selectedDate, 'yyyy-MM-dd') + 'T12:00:00'))
  const [dateInputText, setDateInputText] = useState(format(selectedDate, 'MMMM d, yyyy'))
  const [showCalendar, setShowCalendar] = useState(false)
  const [roomId, setRoomId]       = useState(initialRoomId ?? reservation?.room_id ?? rooms[0]?.id ?? '')
  // Admin book on behalf
  const [selectedOwnerId, setSelectedOwnerId] = useState(profile.id)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [title, setTitle]         = useState(reservation?.title ?? '')
  const [notes, setNotes]         = useState(reservation?.notes ?? '')
  const [startVal, setStartVal]   = useState(
    reservation
      ? (() => { const s = toPacificDate(new Date(reservation.start_time)); return `${s.getHours()}:${s.getMinutes().toString().padStart(2, '0')}` })()
      : slotToTimeValue(initialSlot ?? 18)
  )
  const [endVal, setEndVal] = useState(() => {
    if (reservation) {
      const e = toPacificDate(new Date(reservation.end_time))
      return `${e.getHours()}:${e.getMinutes().toString().padStart(2, '0')}`
    }
    const startSlotNum = initialSlot ?? 18
    const endSlotNum = startSlotNum + 1
    return endSlotNum >= 48 ? '24:00' : slotToTimeValue(endSlotNum)
  })
  const [loading, setLoading]           = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteScope, setDeleteScope]   = useState<'this' | 'future' | null>(null)
  const [adminConflicts, setAdminConflicts]     = useState<ConflictItem[]>([])
  const [removingConflicts, setRemovingConflicts] = useState(false)

  // Recurrence state (admin create only)
  const [isRecurring, setIsRecurring]   = useState(false)
  const [frequency, setFrequency]       = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [daysOfWeek, setDaysOfWeek]     = useState<number[]>([selectedDate.getDay()])
  const [endType, setEndType]           = useState<'date' | 'count'>('date')
  const [recurEndDate, setRecurEndDate] = useState(() => defaultRecurEndDate(selectedDate))
  const [endCount, setEndCount]         = useState(10)

  const modalCenterX = useModalCenterX()

  const isAdmin = profile.is_admin
  const isOwn   = reservation?.user_id === profile.id

  const startDate = parseTimeValue(dateVal, startVal)
  const endDate   = parseTimeValue(dateVal, endVal)

  const durationHours = endDate > startDate
    ? (endDate.getTime() - startDate.getTime()) / 3600000
    : 0

  const currentReservationHours = reservation
    ? (new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / 3600000
    : 0
  const hoursRemaining = company && !isAdmin
    ? company.monthly_hours_allotment - hoursUsed + currentReservationHours
    : Infinity
  const wouldExceed = !isAdmin && durationHours > hoursRemaining

  const hoursUntilStart = reservation
    ? (new Date(reservation.start_time).getTime() - Date.now()) / 3600000
    : 0
  const canEdit   = isOwn && !isAdmin && !!reservation && hoursUntilStart > 24
  const canCancel = isOwn && !isAdmin && !!reservation && hoursUntilStart > 24
  const withinCancelPolicy = isOwn && !isAdmin && !!reservation && hoursUntilStart > 0 && hoursUntilStart <= 24

  const endOptions = TIME_OPTIONS.filter(opt => {
    const [h, m] = opt.value.split(':').map(Number)
    const [sh, sm] = startVal.split(':').map(Number)
    return h > sh || (h === sh && m > sm)
  })

  // Preview count for recurring
  const recurOccurrences = isRecurring && isAdmin && durationHours > 0
    ? generateOccurrences(startDate, endDate, frequency, daysOfWeek, endType, recurEndDate, endCount)
    : []

  function toggleDayOfWeek(day: number) {
    setDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  async function handleRemoveConflicts(ids: string[]) {
    setRemovingConflicts(true)
    await Promise.all(ids.map(id => fetch(`/api/reservations/${id}`, { method: 'DELETE' })))
    const remaining = adminConflicts.filter(c => !ids.includes(c.id))
    setAdminConflicts(remaining)
    setRemovingConflicts(false)
    if (remaining.length === 0) handleSave()
  }

  const [pastWarningConfirmed, setPastWarningConfirmed] = useState(false)

  async function handleSave() {
    const bookingDateStr = dateVal
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const isBookingPastDate = bookingDateStr < todayStr
    if (!reservation && isBookingPastDate && !pastWarningConfirmed) {
      setPastWarningConfirmed(true)
      toast('This time is in the past. Click Save again to confirm.', { icon: '⚠️' })
      return
    }
    if (!title.trim()) { toast.error('Please enter a title'); return }
    if (endDate <= startDate) { toast.error('End time must be after start time'); return }
    if (wouldExceed) { toast.error('Not enough hours remaining this month'); return }

    // ── Recurring block creation ───────────────────────────────────────────
    if (isRecurring && isAdmin) {
      if (frequency === 'weekly' && daysOfWeek.length === 0) {
        toast.error('Select at least one day of the week'); return
      }
      if (endType === 'date' && !recurEndDate) {
        toast.error('Please select an end date'); return
      }
      if (recurOccurrences.length === 0) {
        toast.error('No occurrences generated — check your settings'); return
      }
      setLoading(true)
      // If converting an existing reservation to recurring, delete the original first
      if (reservation) {
        await fetch(`/api/reservations/${reservation.id}`, { method: 'DELETE' })
      }
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          title:   title.trim(),
          notes:   notes.trim() || null,
          occurrences: recurOccurrences,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Recurring block created (${data.count} occurrence${data.count !== 1 ? 's' : ''})`)
        onClose(true)
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Something went wrong')
        setLoading(false)
      }
      return
    }
    // ──────────────────────────────────────────────────────────────────────

    setLoading(true)
    const selectedMember = isAdmin && members ? members.find(m => m.id === selectedOwnerId) : null
    const body: Record<string, any> = {
      room_id: roomId,
      title: title.trim(),
      notes: notes.trim() || null,
      start_time: startDate.toISOString(),
      end_time:   endDate.toISOString(),
      formatted_date: format(new Date(dateVal + 'T12:00:00'), 'EEEE, MMMM d, yyyy'),
      formatted_time: `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`,
    }
    // Admin booking on behalf of a member
    if (isAdmin && selectedOwnerId !== profile.id && selectedMember) {
      body.owner_id = selectedOwnerId
      body.owner_company_id = selectedMember.company_id
    }

    const res = reservation
      ? await fetch(`/api/reservations/${reservation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

    if (res.ok) {
      toast.success(reservation ? 'Reservation updated' : 'Reservation created')
      onClose(true)
    } else {
      const data = await res.json()
      if (data.error === 'conflict' && isAdmin && data.conflicts?.length > 0) {
        setAdminConflicts(data.conflicts)
      } else {
        toast.error(data.error ?? 'Something went wrong')
      }
      setLoading(false)
    }
  }

  async function handleDelete(scope: 'this' | 'future' = 'this') {
    if (!reservation) return
    setDeleting(true)
    const url = scope === 'future'
      ? `/api/reservations/${reservation.id}?scope=future`
      : `/api/reservations/${reservation.id}`
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) {
      toast.success(scope === 'future' ? 'Recurring block removed' : 'Occurrence removed')
      onClose(true)
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Could not remove')
      setDeleting(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-[92vw] sm:w-full max-w-lg md:max-w-2xl z-50 max-h-[90vh] overflow-y-auto"
          style={modalCenterX !== null ? { left: modalCenterX } : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <Dialog.Title className="font-semibold text-gray-900 flex items-center gap-2">
              {reservation?.is_admin_block
                ? <><Ban size={15} className="text-slate-500" /> Admin Block</>
                : <><Lock size={15} className="text-blue-600" /> {mode === 'create' ? 'New Reservation' : editing ? 'Edit Reservation' : 'Reservation Details'}</>
              }
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            {/* Read-only view */}
            {mode === 'view' && !editing && reservation ? (
              <div className="space-y-3">
                {reservation.is_admin_block && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1 w-fit">
                    <Repeat size={11} />
                    Recurring Block
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Title</p>
                  <p className="font-semibold text-gray-900">{reservation.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Room</p>
                    <p className="text-sm text-gray-800">{rooms.find(r => r.id === reservation.room_id)?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Date</p>
                    <p className="text-sm text-gray-800">{format(toPacificDate(new Date(reservation.start_time)), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Time</p>
                    <p className="text-sm text-gray-800">
                      {formatTime(toPacificDate(new Date(reservation.start_time)))} – {formatTime(toPacificDate(new Date(reservation.end_time)))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                    <p className="text-sm text-gray-800">
                      {((new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / 3600000).toFixed(1)}h
                    </p>
                  </div>
                </div>
                {!reservation.is_admin_block && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Booked by</p>
                    <p className="text-sm text-gray-800">
                      {reservation.profiles?.full_name}
                      {reservation.companies?.name ? ` · ${reservation.companies.name}` : ''}
                    </p>
                  </div>
                )}
                {reservation.notes && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{reservation.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Edit / Create form */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isRecurring ? 'Block Title' : 'Meeting Title'}
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={isRecurring ? 'e.g. Staff Meeting' : 'e.g. Team Standup'}
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="text"
                    value={dateInputText}
                    onChange={e => setDateInputText(e.target.value)}
                    onBlur={() => {
                      const parsed = parseFuzzyDate(dateInputText)
                      if (parsed) {
                        setDateVal(format(parsed, 'yyyy-MM-dd'))
                        setPastWarningConfirmed(false)
                        setDatePickerMonth(parsed)
                        setDateInputText(format(parsed, 'MMMM d, yyyy'))
                      } else if (dateVal) {
                        setDateInputText(format(new Date(dateVal + 'T12:00:00'), 'MMMM d, yyyy'))
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const parsed = parseFuzzyDate(dateInputText)
                        if (parsed) {
                          setDateVal(format(parsed, 'yyyy-MM-dd'))
                          setPastWarningConfirmed(false)
                          setDatePickerMonth(parsed)
                          setDateInputText(format(parsed, 'MMMM d, yyyy'))
                        }
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. June 24 or 6/24/2026"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCalendar(v => !v)}
                    className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showCalendar ? 'Hide calendar' : 'Show calendar'}
                  </button>
                  {showCalendar && (
                    <div className="relative mt-1 bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={() => setDatePickerMonth(m => subMonths(m, 1))}
                          className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-sm font-semibold text-gray-900">{format(datePickerMonth, 'MMMM yyyy')}</span>
                        <button type="button" onClick={() => setDatePickerMonth(m => addMonths(m, 1))}
                          className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 mb-1">
                        {['S','M','T','W','T','F','S'].map((d, i) => (
                          <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {Array.from({ length: getDay(startOfMonth(datePickerMonth)) }).map((_, i) => (
                          <div key={`pad-${i}`} />
                        ))}
                        {eachDayOfInterval({ start: startOfMonth(datePickerMonth), end: endOfMonth(datePickerMonth) }).map(day => {
                          const selected = dateVal && isSameDay(day, new Date(dateVal + 'T12:00:00'))
                          const today = isToday(day)
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              onClick={() => {
                                setDateVal(format(day, 'yyyy-MM-dd'))
                                setPastWarningConfirmed(false)
                                setDatePickerMonth(day)
                                setDateInputText(format(day, 'MMMM d, yyyy'))
                                setShowCalendar(false)
                              }}
                              className={cn(
                                'text-center text-xs py-1.5 rounded-md transition-colors',
                                selected
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : today
                                  ? 'bg-blue-50 text-blue-600 font-semibold'
                                  : 'hover:bg-gray-100 text-gray-700'
                              )}
                            >
                              {format(day, 'd')}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <select
                    value={roomId}
                    onChange={e => { setRoomId(e.target.value); setAdminConflicts([]) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} (cap. {r.capacity})</option>
                    ))}
                  </select>
                </div>

                {/* Owner field (admin only) */}
                {isAdmin && members && members.length > 0 && mode === 'create' && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                    <button
                      type="button"
                      onClick={() => { setShowOwnerDropdown(v => !v); setOwnerSearch('') }}
                      className="w-full text-left border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {selectedOwnerId === profile.id
                        ? `${profile.full_name} (you)`
                        : (() => { const m = members.find(m => m.id === selectedOwnerId); return m ? `${m.full_name} — ${m.company_name}` : 'Select member' })()
                      }
                    </button>
                    <div className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                      showOwnerDropdown ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
                    )}>
                      <div className="overflow-hidden">
                        <div className="border border-gray-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                          <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                value={ownerSearch}
                                onChange={e => setOwnerSearch(e.target.value)}
                                placeholder="Search members..."
                                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus={showOwnerDropdown}
                              />
                            </div>
                          </div>
                          {members
                            .filter(m => {
                              const q = ownerSearch.toLowerCase()
                              return !q || m.full_name.toLowerCase().includes(q) || m.company_name.toLowerCase().includes(q)
                            })
                            .sort((a, b) => a.full_name.localeCompare(b.full_name))
                            .map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setSelectedOwnerId(m.id); setShowOwnerDropdown(false) }}
                                className={cn(
                                  'w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors',
                                  m.id === selectedOwnerId ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'
                                )}
                              >
                                {m.full_name} <span className="text-gray-400">— {m.company_name}</span>
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <select
                      value={startVal}
                      onChange={e => {
                        const newStart = e.target.value
                        setStartVal(newStart)
                        setAdminConflicts([])
                        const [sh, sm] = newStart.split(':').map(Number)
                        const newEndMinutes = sh * 60 + sm + 30
                        const nh = Math.floor(newEndMinutes / 60)
                        const nm = newEndMinutes % 60
                        if (nh <= 24) setEndVal(`${nh}:${nm === 0 ? '00' : '30'}`)
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TIME_OPTIONS.slice(0, -1).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <select
                      value={endVal}
                      onChange={e => { setEndVal(e.target.value); setAdminConflicts([]) }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {endOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {durationHours > 0 && (
                  <p className="text-xs text-gray-500">
                    Duration: {durationHours.toFixed(1)}h
                    {!isAdmin && hoursRemaining !== Infinity && (
                      <span className={cn('ml-2', wouldExceed ? 'text-red-600 font-medium' : 'text-gray-400')}>
                        ({hoursRemaining.toFixed(1)}h remaining this month)
                      </span>
                    )}
                  </p>
                )}

                {wouldExceed && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    Your company does not have enough hours remaining this month.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    placeholder="Any additional details…"
                  />
                </div>

                {/* ── Repeat (admin only, create or edit) ──────────────── */}
                {isAdmin && editing && (
                  <div className="border-t border-gray-100 pt-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={e => setIsRecurring(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Repeat size={13} className="text-gray-500" />
                      Repeat
                    </label>

                    <div className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                      isRecurring ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}>
                      <div className="overflow-hidden">
                        <div className="mt-3 space-y-3 pl-1">
                          {/* Frequency buttons */}
                          <div className="flex gap-1.5">
                            {(['daily', 'weekly', 'monthly'] as const).map(f => (
                              <button key={f} type="button" onClick={() => setFrequency(f)}
                                className={cn(
                                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize',
                                  frequency === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}>
                                {f}
                              </button>
                            ))}
                          </div>

                          {/* Days of week (weekly only) */}
                          {frequency === 'weekly' && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-gray-500 mr-1">On:</span>
                              {DAYS.map(({ label, day }) => (
                                <button key={day} type="button" onClick={() => toggleDayOfWeek(day)}
                                  className={cn(
                                    'w-8 h-8 text-sm font-medium rounded-full transition-colors',
                                    daysOfWeek.includes(day) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  )}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* End condition */}
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-gray-700">Ends:</span>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="recurEnd" value="date"
                                checked={endType === 'date'} onChange={() => setEndType('date')} />
                              <span className="text-sm text-gray-700">On</span>
                              <div className="flex-1">
                                <MiniDatePicker
                                  value={recurEndDate}
                                  onChange={setRecurEndDate}
                                  disabled={endType !== 'date'}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="recurEnd" value="count"
                                checked={endType === 'count'} onChange={() => setEndType('count')} />
                              <span className="text-sm text-gray-700">After</span>
                              <input type="number" min={1} max={365} value={endCount}
                                onChange={e => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                                disabled={endType !== 'count'}
                                className="w-20 text-sm border border-gray-300 rounded-lg px-3 py-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">occurrences</span>
                            </div>
                          </div>

                          {/* Preview count */}
                          <p className={cn('text-sm', recurOccurrences.length > 0 ? 'text-gray-500' : 'text-red-500')}>
                            {recurOccurrences.length > 0
                              ? `Will create ${recurOccurrences.length} occurrence${recurOccurrences.length !== 1 ? 's' : ''}`
                              : 'No occurrences — check settings'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* ──────────────────────────────────────────────────────── */}
              </div>
            )}

            {/* Admin conflict warning */}
            {adminConflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  This room isn't available for the selected time. The following bookings need to be removed first:
                </p>
                <ul className="space-y-2">
                  {adminConflicts.map(c => (
                    <li key={c.id} className="flex items-start justify-between gap-2">
                      <div className="text-sm text-amber-700">
                        <span className="font-medium">{c.title}</span>
                        {c.company && <span className="text-amber-600"> · {c.company}</span>}
                        {c.booked_by && <span className="text-amber-600"> · {c.booked_by}</span>}
                        <span className="block text-amber-500 mt-0.5">
                          {formatTime(toPacificDate(new Date(c.start_time)))} – {formatTime(toPacificDate(new Date(c.end_time)))}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveConflicts([c.id])}
                        disabled={removingConflicts}
                        className="flex-shrink-0 text-sm font-medium text-red-600 hover:text-red-800 underline disabled:opacity-40 mt-0.5"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {adminConflicts.length > 1 && (
                  <button
                    onClick={() => handleRemoveConflicts(adminConflicts.map(c => c.id))}
                    disabled={removingConflicts}
                    className="text-sm font-medium text-red-600 hover:text-red-800 underline disabled:opacity-40"
                  >
                    {removingConflicts ? 'Removing…' : 'Remove all'}
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">

                {/* Admin delete — admin block */}
                {isAdmin && mode === 'view' && !editing && reservation?.is_admin_block && (
                  <div className="grid">
                    <div className={cn(
                      'col-start-1 row-start-1 flex items-center gap-2 transition-all duration-200',
                      deleteScope ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    )}>
                      <span className="text-xs text-red-600">
                        {deleteScope === 'future' ? 'Remove this + all future?' : 'Remove this occurrence?'}
                      </span>
                      <button onClick={() => handleDelete(deleteScope ?? 'this')} disabled={deleting}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setDeleteScope(null)} className="text-xs text-gray-500">No</button>
                    </div>
                    <div className={cn(
                      'col-start-1 row-start-1 flex items-center gap-3 transition-all duration-200',
                      !deleteScope ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    )}>
                      <button onClick={() => setDeleteScope('this')}
                        className="text-xs text-red-500 hover:text-red-700 underline">
                        Remove this
                      </button>
                      {reservation.recurrence_group_id && (
                        <button onClick={() => setDeleteScope('future')}
                          className="text-xs text-red-500 hover:text-red-700 underline">
                          Remove this + future
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin delete — regular reservation */}
                {isAdmin && mode === 'view' && !editing && !reservation?.is_admin_block && (
                  <div className="grid">
                    <div className={cn(
                      'col-start-1 row-start-1 flex items-center gap-2 transition-all duration-200',
                      confirmDelete ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    )}>
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => handleDelete('this')} disabled={deleting}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500">No</button>
                    </div>
                    <button onClick={() => setConfirmDelete(true)}
                      className={cn(
                        'col-start-1 row-start-1 flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-all duration-200',
                        !confirmDelete ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                      )}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}

                {/* Within 24h policy warning */}
                {withinCancelPolicy && !editing && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    Can't edit or cancel within 24 hours. Contact an admin.
                  </div>
                )}

                {/* Regular user cancel */}
                {canCancel && !editing && (
                  <div className="grid">
                    <div className={cn(
                      'col-start-1 row-start-1 flex items-center gap-2 transition-all duration-200',
                      confirmDelete ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    )}>
                      <span className="text-xs text-red-600">Cancel reservation?</span>
                      <button onClick={() => handleDelete('this')} disabled={deleting}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        {deleting ? '…' : 'Yes, cancel'}
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500">No</button>
                    </div>
                    <button onClick={() => setConfirmDelete(true)}
                      className={cn(
                        'col-start-1 row-start-1 text-sm text-red-500 hover:text-red-700 transition-all duration-200',
                        !confirmDelete ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                      )}>
                      Cancel reservation
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {mode === 'view' && !editing ? (
                  <>
                    <button onClick={() => onClose()} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
                      Close
                    </button>
                    {(isAdmin || canEdit) && !reservation?.is_admin_block && (
                      <button onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium">
                        <Edit2 size={13} /> Edit
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => { if (mode === 'view') setEditing(false); else onClose(); }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={loading || wouldExceed || adminConflicts.length > 0 || !dateVal}
                      className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-semibold">
                      {loading ? 'Saving…' : <><Check size={14} /> {isRecurring ? 'Create Block' : 'Save'}</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
