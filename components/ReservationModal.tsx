'use client'

import { useState, useEffect } from 'react'
import { format, addMinutes } from 'date-fns'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Lock, Trash2, Edit2, Check, AlertCircle } from 'lucide-react'
import { Reservation, Room, Profile, Company } from '@/types'
import { cn, buildTimeOptions, parseTimeValue, formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const START_HOUR = 7
const TIME_OPTIONS = buildTimeOptions()

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

function slotToTimeValue(slot: number): string {
  const h = START_HOUR + Math.floor(slot / 2)
  const m = slot % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
}

export default function ReservationModal({
  mode, reservation, initialRoomId, initialSlot, selectedDate,
  rooms, profile, company, hoursUsed, onClose
}: Props) {
  const [editing, setEditing] = useState(mode === 'create')
  const [roomId, setRoomId]   = useState(initialRoomId ?? reservation?.room_id ?? rooms[0]?.id ?? '')
  const [title, setTitle]     = useState(reservation?.title ?? '')
  const [notes, setNotes]     = useState(reservation?.notes ?? '')
  const [startVal, setStartVal] = useState(
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
    const nextSlot = Math.min(startSlotNum + 2, 29)
    return slotToTimeValue(nextSlot)
  })
  const [loading, setLoading]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isAdmin   = profile.is_admin
  const isOwn     = reservation?.user_id === profile.id
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
  const canCancel = isOwn && !isAdmin && !!reservation && hoursUntilStart > 24
  const withinCancelPolicy = isOwn && !isAdmin && !!reservation && hoursUntilStart > 0 && hoursUntilStart <= 24

  const endOptions = TIME_OPTIONS.filter(opt => {
    const [h, m] = opt.value.split(':').map(Number)
    const [sh, sm] = startVal.split(':').map(Number)
    return h > sh || (h === sh && m > sm)
  })

  async function handleSave() {
    if (!title.trim()) { toast.error('Please enter a title'); return }
    if (endDate <= startDate) { toast.error('End time must be after start time'); return }
    if (wouldExceed) { toast.error('Not enough hours remaining this month'); return }

    setLoading(true)
    const body = {
      room_id: roomId,
      title: title.trim(),
      notes: notes.trim() || null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
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
      toast.error(data.error ?? 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!reservation) return
    setDeleting(true)
    const res = await fetch(`/api/reservations/${reservation.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Reservation cancelled')
      onClose(true)
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Could not cancel reservation')
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
              <Lock size={15} className="text-blue-600" />
              {mode === 'create' ? 'New Reservation' : editing ? 'Edit Reservation' : 'Reservation Details'}
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            {/* Read-only view */}
            {mode === 'view' && !editing && reservation ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Meeting</p>
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
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Booked by</p>
                  <p className="text-sm text-gray-800">
                    {reservation.profiles?.full_name}
                    {reservation.companies?.name ? ` · ${reservation.companies.name}` : ''}
                  </p>
                </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Team Standup"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <select
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
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
                      onChange={e => setStartVal(e.target.value)}
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
                      onChange={e => setEndVal(e.target.value)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    placeholder="Any additional details…"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Admin delete */}
                {isAdmin && mode === 'view' && !editing && (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={handleDelete} disabled={deleting}
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
                    Can't cancel within 24 hours. Contact an admin.
                  </div>
                )}
                {/* Regular user cancel */}
                {canCancel && !editing && (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Cancel reservation?</span>
                      <button onClick={handleDelete} disabled={deleting}
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
                    {isAdmin && (
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
                      {loading ? 'Saving…' : <><Check size={14} /> Save</>}
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
