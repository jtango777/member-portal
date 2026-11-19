'use client'

import { cn } from '@/lib/utils'

/**
 * Every room's day at a glance, for the public booking page.
 *
 * The same shape as the Rooms grid in the member portal: rooms across the
 * top, the day down the side, one cell per half hour. It answers the
 * question the room cards cannot, which is "what is actually free", and
 * it is how somebody who finds their first choice taken sees the whole
 * day rather than being handed a list (Caroline, 2026-11-19).
 *
 * Two deliberate differences from the portal's version.
 *
 * It never says who booked anything. The portal shows members each
 * other's names because they share an office; this page is open to the
 * internet, so a busy cell says "Booked" and nothing else. The data
 * behind it carries times only, so there is no name here to leak even by
 * accident.
 *
 * And it books by clicking a free cell rather than dragging. Dragging is
 * worth its complexity for staff rescheduling all day; for one booking it
 * is a thing to learn for no gain.
 */

export type GridRoom = {
  id: string
  external_name: string
  capacity: number
  price_per_hour: number
}

export default function DayGrid({
  rooms, slots, labelFor, taken, past, selectedRoomId, selectedStart, selectedEnd, onPick,
}: {
  rooms: GridRoom[]
  /** Every bookable half hour of the day, in order, as "9:00", "9:30". */
  slots: string[]
  labelFor: (slot: string) => string
  /** Slots somebody else has, per room. */
  taken: (roomId: string) => Set<string>
  /**
   * Slots that have simply gone, on today's date.
   *
   * Kept apart from the booked ones on purpose. Lumping them together
   * showed every room as "Booked" all morning, which reads as a fully
   * sold building rather than a day that has started
   * (Caroline, 2026-11-19).
   */
  past: Set<string>
  selectedRoomId?: string
  selectedStart?: string
  selectedEnd?: string
  onPick: (roomId: string, slot: string) => void
}) {
  const minutes = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  const inSelection = (roomId: string, slot: string) =>
    roomId === selectedRoomId && !!selectedStart && !!selectedEnd
    && minutes(slot) >= minutes(selectedStart) && minutes(slot) < minutes(selectedEnd)

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200/80 bg-white">
      <table className="w-full border-collapse" style={{ minWidth: 120 + rooms.length * 110 }}>
        <thead>
          <tr>
            <th className="w-[72px] sticky left-0 z-10 bg-white" />
            {rooms.map(r => (
              <th key={r.id} className="p-2 border-b border-gray-100 text-left align-bottom">
                <span className="block text-sm font-semibold text-gray-900 leading-tight">
                  {r.external_name}
                </span>
                <span className="block text-xs text-gray-500">
                  up to {r.capacity} · ${r.price_per_hour}/hr
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => {
            // The hour reads once, against its first half, the way a diary
            // is written. A label on every row is twice the ink for the
            // same information.
            const onTheHour = slot.endsWith(':00')
            return (
              <tr key={slot}>
                <th className={cn(
                  'w-[72px] sticky left-0 z-10 bg-white align-top pr-2 text-right',
                  'text-[11px] font-medium text-gray-400 whitespace-nowrap',
                  onTheHour ? 'pt-0.5' : 'text-transparent',
                )}>
                  {onTheHour ? labelFor(slot) : '·'}
                </th>
                {rooms.map(room => {
                  const isPast = past.has(slot)
                  const isTaken = !isPast && taken(room.id).has(slot)
                  const picked = inSelection(room.id, slot)
                  const firstOfSelection = picked && slot === selectedStart
                  return (
                    <td
                      key={room.id}
                      className={cn(
                        'h-7 border-l border-gray-100 p-0',
                        onTheHour ? 'border-t border-gray-200' : 'border-t border-gray-100',
                        i === slots.length - 1 && 'border-b border-gray-200',
                      )}
                    >
                      {isPast ? (
                        // Gone, not sold. Flat and unlabelled, so the eye
                        // skips it rather than reading it as demand.
                        <div
                          className="h-full w-full bg-gray-50"
                          aria-label={`${labelFor(slot)}, already passed`}
                        />
                      ) : isTaken ? (
                        <div
                          className="h-full w-full bg-gray-200/70 text-[10px] text-gray-500 px-1.5 flex items-center"
                          aria-label={`${room.external_name}, ${labelFor(slot)}, booked`}
                        >
                          {/* Named nowhere: this page is public. */}
                          {onTheHour && 'Booked'}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPick(room.id, slot)}
                          aria-label={`Book ${room.external_name} from ${labelFor(slot)}`}
                          className={cn(
                            'h-full w-full transition-colors',
                            picked
                              ? 'bg-booking-600'
                              : 'hover:bg-booking-600/15 focus:bg-booking-600/15 focus:outline-none',
                          )}
                        >
                          {firstOfSelection && (
                            <span className="block text-[10px] font-semibold text-white px-1.5 text-left">
                              Yours
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
