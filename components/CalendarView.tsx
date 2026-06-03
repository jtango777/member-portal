'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { format, addDays, subDays, isToday, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Lock, FileText, Plus, Users, Clock } from 'lucide-react'
import { Location, Room, Reservation, Profile, Company } from '@/types'
import { cn, formatTime, isSameDay } from '@/lib/utils'
import ReservationModal from './ReservationModal'

// Calendar constants
const START_HOUR = 7      // 7 AM
const END_HOUR   = 22     // 10 PM
const SLOT_H     = 56     // px per 30-min slot
const TIME_W     = 64     // px for time label column
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2  // 30 slots

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; roomId: string; startSlot: number }
  | { mode: 'view';   reservation: Reservation }

type Props = {
  locations:         Location[]
  profile:           Profile
  company:           Company | null
  hoursUsed:         number
  defaultLocationId: string | null
}

export default function CalendarView({ locations, profile, company, hoursUsed, defaultLocationId }: Props) {
  const defaultLocation = locations.find(l => l.id === defaultLocationId) ?? locations[0]
  const [selectedLocation, setSelectedLocation] = useState<Location>(defaultLocation)
  const [selectedDate, setSelectedDate]         = useState<Date>(new Date())
  const [rooms, setRooms]                       = useState<Room[]>([])
  const [reservations, setReservations]         = useState<Reservation[]>([])
  const [loading, setLoading]                   = useState(false)
  const [modal, setModal]                       = useState<ModalState>({ mode: 'closed' })
  const scrollRef = useRef<HTMLDivElement>(null)

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
  }, [selectedLocation, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SLOT_H * 2
    }
  }, [])

  function slotToTime(slot: number): Date {
    const h = START_HOUR + Math.floor(slot / 2)
    const m = slot % 2 === 0 ? 0 : 30
    const d = new Date(selectedDate)
    d.setHours(h, m, 0, 0)
    return d
  }

  function timeToSlot(dateStr: string): number {
    const d = new Date(dateStr)
    return (d.getHours() - START_HOUR) * 2 + Math.floor(d.getMinutes() / 30)
  }

  function getReservationsForRoom(roomId: string) {
    return reservations.filter(r => r.room_id === roomId)
  }

  function handleSlotClick(roomId: string, slot: number) {
    if (isBefore(startOfDay(selectedDate), startOfDay(new Date())) && !isSameDay(selectedDate, new Date())) return
    setModal({ mode: 'create', roomId, startSlot: slot })
  }

  function handleBookingClick(res: Reservation) {
    setModal({ mode: 'view', reservation: res })
  }

  function handleModalClose(refresh?: boolean) {
    setModal({ mode: 'closed' })
    if (refresh) fetchData()
  }

  const hoursRemaining = company ? Math.max(0, company.monthly_hours_allotment - hoursUsed) : null

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(d => subDays(d, 1))}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className={cn(
              'px-3 py-1 text-sm rounded font-medium transition-colors',
              isToday(selectedDate) ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
            )}
          >
            Today
          </button>
          <button
            onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-900 ml-1">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {company && !profile.is_admin && hoursRemaining !== null && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <Clock size={13} />
              <span>
                <span className={cn('font-semibold', hoursRemaining <= 0 ? 'text-red-600' : 'text-gray-800')}>
                  {hoursRemaining.toFixed(1)}h
                </span>
                {' '}remaining of {company.monthly_hours_allotment}h/mo
              </span>
            </div>
          )}
          <button
            onClick={() => setModal({ mode: 'create', roomId: rooms[0]?.id ?? '', startSlot: 2 })}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span>Make a Reservation</span>
          </button>
        </div>
      </div>

      {/* Location tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0 bg-white px-4">
        {locations.map(loc => (
          <button
            key={loc.id}
            onClick={() => setSelectedLocation(loc)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              selectedLocation.id === loc.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {loc.name}
          </button>
        ))}
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
                  <div className="font-semibold text-sm text-gray-900 truncate">{room.name}</div>
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
                      style={{ height: SLOT_H }}
                      className="flex items-start justify-end pr-2 pt-1"
                    >
                      {isHour && (
                        <span className="text-xs text-gray-400 font-medium">
                          {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
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
                    style={{ height: SLOT_H * TOTAL_SLOTS }}
                  >
                    {/* Slot backgrounds / click targets */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                      <div
                        key={i}
                        onClick={() => handleSlotClick(room.id, i)}
                        style={{ top: i * SLOT_H, height: SLOT_H }}
                        className={cn(
                          'absolute inset-x-0 cursor-pointer hover:bg-blue-50 transition-colors',
                          i % 2 === 0 ? 'border-t border-gray-200' : 'border-t border-dashed border-gray-200'
                        )}
                      />
                    ))}

                    {/* Booking cards */}
                    {roomReservations.map(res => {
                      const startSlot = Math.max(0, timeToSlot(res.start_time))
                      const endSlot   = Math.min(TOTAL_SLOTS, timeToSlot(res.end_time))
                      const top    = startSlot * SLOT_H
                      const height = Math.max(SLOT_H / 2, (endSlot - startSlot) * SLOT_H)
                      const isOwn  = res.user_id === profile.id

                      return (
                        <div
                          key={res.id}
                          onClick={e => { e.stopPropagation(); handleBookingClick(res) }}
                          style={{ top: top + 2, height: height - 4, position: 'absolute', left: 3, right: 3 }}
                          className={cn(
                            'rounded-md px-2 py-1 cursor-pointer z-10 overflow-hidden',
                            'transition-all hover:brightness-110 select-none',
                            isOwn
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          )}
                        >
                          <div className="flex items-center gap-1 text-xs font-medium opacity-90">
                            <Lock size={10} className="flex-shrink-0" />
                            <span className="truncate">
                              {formatTime(new Date(res.start_time))} – {formatTime(new Date(res.end_time))}
                            </span>
                            {res.notes && <FileText size={10} className="flex-shrink-0 ml-auto" />}
                          </div>
                          {height >= SLOT_H && (
                            <>
                              <div className="font-semibold text-sm truncate mt-0.5 leading-tight">
                                {res.title}
                              </div>
                              <div className="text-xs opacity-75 truncate">
                                {res.profiles?.full_name}
                                {res.companies?.name ? ` · ${res.companies.name}` : ''}
                              </div>
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

      {/* Modal */}
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
          hoursUsed={hoursUsed}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

