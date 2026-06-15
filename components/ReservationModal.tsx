'use client'

import { useState } from 'react'
import { format, addDays, addMonths } from 'date-fns'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Lock, Trash2, Edit2, Check, AlertCircle, Repeat, Ban } from 'lucide-react'
import { Reservation, Room, Profile, Company } from '@/types'
import { cn, buildTimeOptions, parseTimeValue, formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const START_HOUR = 7
const TIME_OPTIONS = buildTimeOptions()

const DAYS = [
  { label: 'S', day: 0 }, { label: 'M', day: 1 }, { label: 'T', day: 2 },
  { label: 'W', day: 3 }, { label: 'T', day: 4 }, { label: 'F', day: 5 }, { label: 'S', day: 6 },
]

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

  const maxDate   = endType === 'date' && endDateStr ? new Date(endDateStr + 'T23:59:59') : null
  const maxCount  = endType === 'count' ? Math.min(endCount, 365) : 500

  function push(start: Date): boolean {
    if (results.length >= maxCount) return false
    if (maxDate && start > maxDate) return false
    results.push({ start_time: start.toISOString(), end_time: new Date(start.getTime() + durationMs).toISOString() })
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
        candidate.setHours(baseStart.getHours(), baseStart.getMinutes(), 0, 0)
        if (candidate < baseStart) continue
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
  rooms, profile, company, hoursUsed, onClose
}: Props) {
  const [editing, setEditing]     = useState(mode === 'create')
  const [roomId, setRoomId]       = useState(initialRoomId ?? reservation?.room_id ?? rooms[0]?.id ?? '')
  const [title, setTitle]         = useState(reservation?.title ?? '')
  const [notes, setNotes]         = useState(reservation?.notes ?? '')
  const [startVal, setStartVal]   = useState(
    reservation
      ? `${new Date(reservation.start_time).getHours()}:${new Date(reservation.start_time).getMinutes().toString().padStart(2, '0')}`
      : slotToTimeValue(initialSlot ?? 2)
  )
  const [endVal, setEndVal] = useState(() => {
    if (reservation) {
      const e = new Date(reservation.end_time)
      return `${e.getHours()}:${e.getMinutes().toString().padStart(2, '0')}`
    }
    const startSlotNum = initialSlot ?? 2
    return slotToTimeValue(Math.min(startSlotNum + 2, 29))
  })
  const [loading, setLoading]           = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteScope, setDeleteScope]   = useState<'this' | 'future' | null>(null)
  const [adminConflicts, setAdminConflicts] = useState<ConflictItem[]>([])

  // Recurrence state (admin create only)
  const [isRecurring, setIsRecurring]   = useState(false)
  const [frequency, setFrequency]       = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [daysOfWeek, setDaysOfWeek]     = useState<number[]>([selectedDate.getDay()])
  const [endType, setEndType]           = useState<'date' | 'count'>('date')
  const [recurEndDate, setRecurEndDate] = useState(() => defaultRecurEndDate(selectedDate))
  const [endCount, setEndCount]         = useState(10)

  const isAdmin = profile.is_admin
  const isOwn   = reservation?.user_id === profile.id

  const startDate = parseTimeValue(format(selectedDate, 'yyyy-MM-dd'), startVal)
  const endDate   = parseTimeValue(format(selectedDate, 'yyyy-MM-dd'), endVal)

  const durationHours = endDate > startDate
    ? (endDate.getTime() - startDate.getTime()) / 3600000
    : 0

  const hoursRemaining = company && !isAdmin
    ? Math.max(0, company.monthly_hours_allotment - hoursUsed)
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

  async function handleSave() {
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
    const body = {
      room_id: roomId,
      title: title.trim(),
      notes: notes.trim() || null,
      start_time: startDate.toISOString(),
      end_time:   endDate.toISOString(),
      formatted_date: format(selectedDate, 'EEEE, MMMM d, yyyy'),
      formatted_time: `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`,
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
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-md z-50 overflow-hidden">
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
                    <p className="text-sm text-gray-800">{format(new Date(reservation.start_time), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Time</p>
                    <p className="text-sm text-gray-800">
                      {formatTime(new Date(reservation.start_time))} – {formatTime(new Date(reservation.end_time))}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <select
                      value={startVal}
                      onChange={e => { setStartVal(e.target.value); setAdminConflicts([]) }}
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

                {/* ── Repeat (admin create only) ────────────────────────── */}
                {isAdmin && mode === 'create' && (
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

                    {isRecurring && (
                      <div className="mt-3 space-y-3 pl-1">
                        {/* Frequency buttons */}
                        <div className="flex gap-1">
                          {(['daily', 'weekly', 'monthly'] as const).map(f => (
                            <button key={f} type="button" onClick={() => setFrequency(f)}
                              className={cn(
                                'px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                                frequency === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              )}>
                              {f}
                            </button>
                          ))}
                        </div>

                        {/* Days of week (weekly only) */}
                        {frequency === 'weekly' && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 mr-1 w-6">On:</span>
                            {DAYS.map(({ label, day }) => (
                              <button key={day} type="button" onClick={() => toggleDayOfWeek(day)}
                                className={cn(
                                  'w-7 h-7 text-xs font-medium rounded-full transition-colors',
                                  daysOfWeek.includes(day) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* End condition */}
                        <div className="space-y-2">
                          <span className="text-xs text-gray-500">Ends:</span>
                          <div className="flex items-center gap-2">
                            <input type="radio" name="recurEnd" value="date"
                              checked={endType === 'date'} onChange={() => setEndType('date')} />
                            <span className="text-xs text-gray-700">On</span>
                            <input type="date" value={recurEndDate}
                              onChange={e => setRecurEndDate(e.target.value)}
                              disabled={endType !== 'date'}
                              className="text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="radio" name="recurEnd" value="count"
                              checked={endType === 'count'} onChange={() => setEndType('count')} />
                            <span className="text-xs text-gray-700">After</span>
                            <input type="number" min={1} max={365} value={endCount}
                              onChange={e => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                              disabled={endType !== 'count'}
                              className="w-16 text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">occurrences</span>
                          </div>
                        </div>

                        {/* Preview count */}
                        <p className={cn('text-xs', recurOccurrences.length > 0 ? 'text-gray-500' : 'text-red-500')}>
                          {recurOccurrences.length > 0
                            ? `Will create ${recurOccurrences.length} occurrence${recurOccurrences.length !== 1 ? 's' : ''}`
                            : 'No occurrences — check settings'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {/* ──────────────────────────────────────────────────────── */}
              </div>
            )}

            {/* Admin conflict warning */}
            {adminConflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  This room isn't available for the selected time. The following bookings need to be removed first:
                </p>
                <ul className="space-y-1.5 pl-0.5">
                  {adminConflicts.map(c => (
                    <li key={c.id} className="text-xs text-amber-700">
                      <span className="font-medium">{c.title}</span>
                      {c.company && <span className="text-amber-600"> · {c.company}</span>}
                      {c.booked_by && <span className="text-amber-600"> · {c.booked_by}</span>}
                      <span className="block text-amber-500 mt-0.5">
                        {formatTime(new Date(c.start_time))} – {formatTime(new Date(c.end_time))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">

                {/* Admin delete — admin block */}
                {isAdmin && mode === 'view' && !editing && reservation?.is_admin_block && (
                  deleteScope ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">
                        {deleteScope === 'future' ? 'Remove this + all future?' : 'Remove this occurrence?'}
                      </span>
                      <button onClick={() => handleDelete(deleteScope)} disabled={deleting}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setDeleteScope(null)} className="text-xs text-gray-500">No</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
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
                  )
                )}

                {/* Admin delete — regular reservation */}
                {isAdmin && mode === 'view' && !editing && !reservation?.is_admin_block && (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => handleDelete('this')} disabled={deleting}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                      <Trash2 size={14} /> Delete
                    </button>
                  )
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
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Cancel reservation?</span>
                      <button onClick={() => handleDelete('this')} disabled={deleting}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        {deleting ? '…' : 'Yes, cancel'}
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)}
                      className="text-sm text-red-500 hover:text-red-700">
                      Cancel reservation
                    </button>
                  )
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
                    <button onClick={handleSave} disabled={loading || wouldExceed}
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
