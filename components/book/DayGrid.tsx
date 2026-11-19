'use client'

import { useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Every room's day at a glance, for the public booking page.
 *
 * Drawn the way the member portal's calendar is drawn, because it is the
 * same information: a time rail down the left, a column per room, and
 * each booking one solid block as tall as it is long. The first version
 * of this was a table with a grey cell per half hour, which repeated the
 * word "Booked" down the column and made a two hour meeting look like
 * four separate ones (Caroline, 2026-11-19).
 *
 * Two deliberate differences from the portal's version.
 *
 * It never says who booked anything. Members see each other's names
 * because they share an office; this page is open to the internet, so a
 * block carries its hours and nothing else. The data behind it has no
 * name in it to leak.
 *
 * And hours that have merely passed are not drawn as bookings. They were
 * shaded the same grey as a booked block, so a morning that had simply
 * gone looked like a sold-out building. Now the only mark is a line
 * across the day showing where "now" is, and those slots quietly refuse
 * to be clicked.
 */

export type GridRoom = {
  id: string
  external_name: string
  capacity: number
  price_per_hour: number
}

export type Busy = { start: string; end: string }

const MIN_SLOT_H = 18
const MAX_SLOT_H = 56
const DEFAULT_SLOT_H = 28

function mins(s: string) {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

export default function DayGrid({
  rooms, slots, closeSlot, labelFor, busy, nowMinutes,
  selectedRoomId, selectedStart, selectedEnd, onPick,
}: {
  rooms: GridRoom[]
  slots: string[]
  /** The end of the last slot, so the final block has somewhere to stop. */
  closeSlot: string
  labelFor: (slot: string) => string
  /** Somebody else's time in a room, already merged into runs. */
  busy: (roomId: string) => Busy[]
  /** Minute of the day it is now, or null on a day that is not today. */
  nowMinutes: number | null
  selectedRoomId?: string
  selectedStart?: string
  selectedEnd?: string
  onPick: (roomId: string, slot: string) => void
}) {
  const [slotH, setSlotH] = useState(DEFAULT_SLOT_H)

  const dayStart = mins(slots[0] ?? '9:00')
  const dayEnd = mins(closeSlot)
  const perMinute = slotH / 30
  const top = (minute: number) => (minute - dayStart) * perMinute
  const height = (from: number, to: number) => (to - from) * perMinute
  const bodyH = (dayEnd - dayStart) * perMinute

  return (
    <div className="rounded-xl ring-1 ring-gray-200/80 bg-white overflow-hidden">
      {/* The same zoom the portal's calendar has, so a long day can be
          squeezed into one screen or opened out to read. */}
      <div className="flex items-center justify-end gap-2.5 px-3 py-2 border-b border-gray-100">
        <ZoomOut size={12} className="text-gray-300" />
        <input
          type="range"
          aria-label="Row height"
          min={MIN_SLOT_H}
          max={MAX_SLOT_H}
          value={slotH}
          onChange={e => setSlotH(Number(e.target.value))}
          // The filled part of the track is drawn from the value, since
          // only Firefox gives you ::-moz-range-progress for free.
          style={{ ['--fill' as string]: `${((slotH - MIN_SLOT_H) / (MAX_SLOT_H - MIN_SLOT_H)) * 100}%` }}
          className="zoom-range w-24"
        />
        <ZoomIn size={12} className="text-gray-300" />
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 72 + rooms.length * 130 }}>
          {/* Room headings */}
          <div className="flex border-b border-gray-200 bg-white">
            <div className="w-[72px] shrink-0" />
            {rooms.map(r => (
              <div key={r.id} className="flex-1 min-w-[130px] px-2 py-2 border-l border-gray-100">
                <div className="text-sm font-semibold text-gray-900 leading-tight">{r.external_name}</div>
                <div className="text-xs text-gray-500">up to {r.capacity} · ${r.price_per_hour}/hr</div>
              </div>
            ))}
          </div>

          {/* The day scrolls inside its own box rather than making the
              whole page tall, so the room headings stay put while you
              move through the hours (Caroline, 2026-11-19). */}
          <div className="overflow-y-auto py-2" style={{ maxHeight: 460 }}>
            <div className="flex relative" style={{ height: bodyH }}>
              {/* Time rail */}
              <div className="w-[72px] shrink-0 relative">
                {/* Closing time included. The labels came from the start
                    times, which stop at half four, so the day just ran
                    out with no line at five (Caroline, 2026-11-19). */}
                {[...slots.filter(s => s.endsWith(':00')), closeSlot].map(s => (
                  <div
                    key={s}
                    className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400 whitespace-nowrap"
                    style={{ top: top(mins(s)) }}
                  >
                    {labelFor(s)}
                  </div>
                ))}
              </div>

              {rooms.map(room => {
                const blocks = busy(room.id)
                const selected = room.id === selectedRoomId && selectedStart && selectedEnd
                  ? { start: selectedStart, end: selectedEnd }
                  : null
                return (
                  <div key={room.id} className="flex-1 min-w-[130px] relative border-l border-gray-100">
                    {slots.map(s => {
                      const m = mins(s)
                      const taken = blocks.some(b => m >= mins(b.start) && m < mins(b.end))
                      const gone = nowMinutes !== null && m <= nowMinutes
                      return (
                        <div
                          key={s}
                          className={cn(
                            'absolute inset-x-0 border-t',
                            s.endsWith(':00') ? 'border-gray-200' : 'border-gray-50',
                          )}
                          style={{ top: top(m), height: slotH }}
                        >
                          {!taken && !gone && (
                            <button
                              type="button"
                              onClick={() => onPick(room.id, s)}
                              aria-label={`Book ${room.external_name} from ${labelFor(s)}`}
                              className="absolute inset-0 w-full hover:bg-booking-600/15 focus:bg-booking-600/15 focus:outline-none transition-colors"
                            />
                          )}
                        </div>
                      )
                    })}

                    {/* The closing line, drawn the way every other hour
                        line is: inside the column, so it starts and stops
                        where they do. As a border on the whole row it ran
                        under the time rail too and sat adrift of the card
                        edge (Caroline, 2026-11-19). */}
                    <div
                      className="absolute inset-x-0 border-t border-gray-200"
                      style={{ top: bodyH }}
                    />

                    {blocks.map(b => (
                      <div
                        key={b.start}
                        className="absolute inset-x-1 rounded-md bg-gray-100 ring-1 ring-gray-200/80 px-1.5 py-0.5 overflow-hidden"
                        style={{ top: top(mins(b.start)) + 1, height: height(mins(b.start), mins(b.end)) - 2 }}
                      >
                        <div className="text-[10px] font-medium text-gray-500 leading-tight">
                          {labelFor(b.start)} – {labelFor(b.end)}
                        </div>
                        <div className="text-[10px] text-gray-400">Booked</div>
                      </div>
                    ))}

                    {selected && (
                      <div
                        className="absolute inset-x-1 rounded-md bg-booking-600 px-1.5 py-0.5 overflow-hidden"
                        style={{ top: top(mins(selected.start)) + 1, height: height(mins(selected.start), mins(selected.end)) - 2 }}
                      >
                        <div className="text-[10px] font-semibold text-white leading-tight">
                          {labelFor(selected.start)} – {labelFor(selected.end)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Where the day has got to. Inside the columns, not across
                  the page: it was absolutely positioned against the whole
                  document and ran edge to edge (Caroline, 2026-11-19). */}
              {nowMinutes !== null && nowMinutes > dayStart && nowMinutes < dayEnd && (
                <div
                  className="absolute left-[56px] right-0 h-px bg-red-400/70 pointer-events-none"
                  style={{ top: top(nowMinutes) }}
                >
                  <span className="absolute -top-[7px] -left-[34px] text-[9px] font-semibold text-red-500">
                    now
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
