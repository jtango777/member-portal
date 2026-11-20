'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
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
// Opens at roughly a third of the way up the slider: tight enough to see
// most of the working day without scrolling, loose enough that a half hour
// is a real target rather than a hairline (Caroline, 2026-11-20).
const DEFAULT_SLOT_H = 34

function mins(s: string) {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

export default function DayGrid({
  rooms, slots, closeSlot, labelFor, busy, nowMinutes,
  selectedRoomId, selectedStart, selectedEnd, onSelect, onClear, bookHref, priceFor,
  closedNote, dayLabel, onPrevDay, onNextDay, canPrevDay, canNextDay,
  outsideHoursContact,
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
  onSelect: (roomId: string, start: string, end: string) => void
  /** Drop the chosen time and leave nothing highlighted. */
  onClear: () => void
  /** Where "Book" goes, once there is something to book. */
  bookHref: (roomId: string, start: string, end: string) => string
  priceFor: (roomId: string, start: string, end: string) => string
  /**
   * Why the whole day is shut — a weekend, a holiday, a closure. The grid
   * then shows the day as entirely unavailable and refuses every click,
   * rather than looking wide open and handing out a Book button for a day
   * the checkout would turn away (Caroline, 2026-11-20).
   */
  closedNote?: {
    heading: string
    detail: string
    /** Only where getting in touch would actually achieve something. A
     *  holiday is shut, full stop, and inviting a call about it just
     *  makes work for somebody (Caroline, 2026-11-20). */
    contact?: { phone: string; email: string }
  } | null
  /** The day on show, e.g. "Friday, Nov 20". */
  dayLabel: string
  onPrevDay: () => void
  onNextDay: () => void
  canPrevDay: boolean
  canNextDay: boolean
  /** Who to ask about an hour outside the bookable day. */
  outsideHoursContact?: { phone: string; email: string }
}) {
  const closed = !!closedNote
  const [slotH, setSlotH] = useState(DEFAULT_SLOT_H)

  /**
   * Dragging down a column to choose a length, the way a calendar is
   * normally used. A click is the same gesture over one slot, so it
   * still gives the half hour it landed on (Caroline, 2026-11-19).
   */
  const [dragFrom, setDragFrom] = useState<{ roomId: string; index: number } | null>(null)
  /**
   * Whether the pointer actually travelled, so the click that follows a
   * drag does not collapse the range back to the slot it started on.
   */
  const dragged = useRef(false)

  // Escape clears the selection too, since that is what Escape does.
  const hasSelection = !!(selectedRoomId && selectedStart && selectedEnd)
  useEffect(() => {
    if (!hasSelection) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClear() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasSelection, onClear])

  useEffect(() => {
    if (!dragFrom) return
    const stop = () => setDragFrom(null)
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [dragFrom])

  /** The run of free slots around an anchor, clamped by whatever blocks it. */
  function rangeTo(roomId: string, from: number, to: number, blocked: (i: number) => boolean) {
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    let start = from
    let end = from
    for (let i = from; i >= lo; i--) { if (blocked(i)) break; start = i }
    for (let i = from; i <= hi; i++) { if (blocked(i)) break; end = i }
    return { start: slots[start], end: slots[end + 1] ?? closeSlot }
  }

  const dayStart = mins(slots[0] ?? '9:00')
  const dayEnd = mins(closeSlot)
  const perMinute = slotH / 30
  /**
   * A strip at each end of the day, so nine to five reads as a window
   * with edges. The grid simply stopped at both ends, which said nothing
   * about whether the hours outside existed (Caroline, 2026-11-20).
   */
  const CAP = Math.max(slotH, 28)
  const top = (minute: number) => CAP + (minute - dayStart) * perMinute
  const height = (from: number, to: number) => (to - from) * perMinute
  const dayBottom = top(dayEnd)
  const bodyH = dayBottom + CAP
  const HATCH = 'repeating-linear-gradient(45deg, rgba(17,24,39,0.03) 0 4px, transparent 4px 8px)'

  /**
   * The line written on each end of the day, word for word the same.
   *
   * It named the hour at each end, "Before 9:00 AM?" and "After 5:00
   * PM?", which is already obvious from where the strip sits. What a
   * visitor wants to know is that there is a way to ask
   * (Caroline, 2026-11-20).
   */
  const capNote = (
    <span className="text-[10px] text-gray-400 text-center whitespace-nowrap">
      Need outside hours?{' '}
      {outsideHoursContact ? (
        <>
          Call{' '}
          <a
            href={`tel:${outsideHoursContact.phone.replace(/\D/g, '')}`}
            className="text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >{outsideHoursContact.phone}</a>
          {' '}or email{' '}
          <a
            href={`mailto:${outsideHoursContact.email}`}
            className="text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >{outsideHoursContact.email}</a>
        </>
      ) : 'Get in touch and we will try to arrange it.'}
    </span>
  )

  return (
    <div className="rounded-xl ring-1 ring-gray-200/80 bg-white overflow-hidden">
      {/* The same zoom the portal's calendar has, so a long day can be
          squeezed into one screen or opened out to read. */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
        {/* The day controls live in the card's own bar. As a separate row
            above it they pushed the calendar out of line with everything
            in the column beside it (Caroline, 2026-11-20). */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPrevDay}
            disabled={!canPrevDay}
            aria-label="Previous day"
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          ><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">{dayLabel}</span>
          <button
            type="button"
            onClick={onNextDay}
            disabled={!canNextDay}
            aria-label="Next day"
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          ><ChevronRight size={15} /></button>
        </div>

        <div className="flex items-center gap-2.5">
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
          <div className="relative">
          {/* Tall enough that the whole day, both caps included, is there
              at the zoom it opens on. At 460 the line about hours outside
              nine to five sat below the fold of a box nobody would think
              to scroll (Caroline, 2026-11-20). */}
          <div className="overflow-y-auto py-2" style={{ maxHeight: 640 }}>
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
                const selected = !closed && room.id === selectedRoomId && selectedStart && selectedEnd
                  ? { start: selectedStart, end: selectedEnd }
                  : null
                return (
                  <div key={room.id} className="flex-1 min-w-[130px] relative border-l border-gray-100">
                    {slots.map((s, i) => {
                      const m = mins(s)
                      const taken = blocks.some(b => m >= mins(b.start) && m < mins(b.end))
                      const gone = closed || (nowMinutes !== null && m <= nowMinutes)
                      const dead = taken || gone
                      const blockedAt = (idx: number) => {
                        const mm = mins(slots[idx])
                        return blocks.some(b => mm >= mins(b.start) && mm < mins(b.end))
                          || (nowMinutes !== null && mm <= nowMinutes)
                      }
                      return (
                        <div
                          key={s}
                          className={cn(
                            'absolute inset-x-0 border-t',
                            s.endsWith(':00') ? 'border-gray-200' : 'border-gray-50',
                          )}
                          style={{
                            top: top(m),
                            height: slotH,
                            // Hours already gone are hatched, not filled:
                            // with no mark at all the grid looked wholly
                            // clickable and most of it was not
                            // (Caroline, 2026-11-19).
                            backgroundImage: gone ? HATCH : undefined,
                          }}
                        >
                          {!dead && (
                            <button
                              type="button"
                              onPointerDown={() => {
                                dragged.current = false
                                setDragFrom({ roomId: room.id, index: i })
                              }}
                              onPointerEnter={() => {
                                if (!dragFrom || dragFrom.roomId !== room.id) return
                                dragged.current = true
                                const r = rangeTo(room.id, dragFrom.index, i, blockedAt)
                                onSelect(room.id, r.start, r.end)
                              }}
                              /**
                               * Click, not just pointerdown. Pointer events
                               * carry the drag, but a plain mouse click is
                               * what most people do and some environments
                               * send nothing else, which left the whole
                               * grid dead to them (Caroline, 2026-11-19).
                               */
                              onClick={() => {
                                if (dragged.current) { dragged.current = false; return }
                                const r = rangeTo(room.id, i, i, blockedAt)
                                onSelect(room.id, r.start, r.end)
                              }}
                              aria-label={`Book ${room.external_name} from ${labelFor(s)}`}
                              // Grey, not green. A green hover tint was
                              // the same family as the chosen block, so
                              // whatever the mouse passed over looked
                              // half chosen too (Caroline, 2026-11-20).
                              className="absolute inset-0 w-full cursor-pointer hover:bg-gray-900/[0.05] focus:bg-gray-900/[0.05] focus:outline-none transition-colors"
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
                      style={{ top: dayBottom }}
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

                    {selected && (() => {
                      const selTop = top(mins(selected.start))
                      const selH = height(mins(selected.start), mins(selected.end))
                      // The action floats under the block rather than
                      // sitting inside it: half an hour is 26 pixels tall
                      // and the button was sliced in half
                      // (Caroline, 2026-11-19).
                      const below = selTop + selH + 4
                      const fits = below + 34 < dayBottom
                      // Room inside the block for the button, and for the
                      // hours and price under the time.
                      const roomy = selH >= 78
                      const mid = selH >= 46
                      return (
                        <>
                          {/* The chosen slots, filled. Not a card floating
                              over them: an inset box left the cell's own
                              tint showing round its edges, so the fill
                              looked ragged and half a step out of place
                              (Caroline, 2026-11-20). */}
                          <div
                            className="absolute inset-x-0 bg-booking-100 px-1.5 py-1 overflow-hidden"
                            style={{ top: selTop, height: selH }}
                          >
                            <div className="flex items-start gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-booking-800 leading-tight truncate">
                                  {labelFor(selected.start)} – {labelFor(selected.end)}
                                </div>
                                {mid && (
                                  <div className="text-[10px] text-booking-700/80 leading-tight truncate">
                                    {priceFor(room.id, selected.start, selected.end)}
                                  </div>
                                )}
                              </div>
                              {/* A way back out. Clicking elsewhere only
                                  moves the selection, so without this
                                  there was no way to undo one
                                  (Caroline, 2026-11-20). */}
                              <button
                                type="button"
                                onClick={onClear}
                                aria-label="Clear this time"
                                className="shrink-0 -mr-0.5 -mt-0.5 rounded p-0.5 text-booking-700/70
                                           hover:text-booking-800 hover:bg-booking-200 transition-colors"
                              ><X size={12} /></button>
                            </div>

                            {roomy && (
                              <a
                                href={bookHref(room.id, selected.start, selected.end)}
                                className="absolute left-1.5 bottom-1.5 rounded-md bg-booking-600 hover:bg-booking-700
                                           px-2 py-1 text-[11px] font-semibold text-white shadow-sm whitespace-nowrap"
                              >
                                Book →
                              </a>
                            )}
                          </div>

                          {/* Too short to hold the button, so it sits
                              under the fill as its own small card. On its
                              own it landed half across whatever was booked
                              below and the two ran together
                              (Caroline, 2026-11-20). */}
                          {!roomy && (
                          <div
                            className="absolute left-1 z-20 flex items-center gap-1.5
                                       rounded-lg bg-white ring-1 ring-gray-200 shadow-md px-1.5 py-1"
                            style={{ top: fits ? below : Math.max(selTop - 32, 0) }}
                          >
                            <a
                              href={bookHref(room.id, selected.start, selected.end)}
                              className="rounded-md bg-booking-600 hover:bg-booking-700 px-2 py-1 text-[11px] font-semibold text-white shadow-sm whitespace-nowrap"
                            >
                              Book →
                            </a>
                            {!mid && (
                              <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                {priceFor(room.id, selected.start, selected.end)}
                              </span>
                            )}
                          </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )
              })}

              {/* The hours either side of the bookable day. Written on,
                  not left to a hover: a tooltip is only found by people
                  who already suspect it is there (Caroline, 2026-11-20). */}
              {/* Flat grey, not hatched. Hatching is what a slot that
                  has merely gone by today looks like, and the two were
                  identical though they mean different things: these
                  hours are never on sale (Caroline, 2026-11-20). */}
              {/* Both ends say the same thing, because they mean the
                  same thing. One of them offering a phone number while
                  the other just named a time read as two different
                  rules (Caroline, 2026-11-20). */}
              <div
                className="absolute left-[72px] right-0 top-0 flex items-center justify-start sm:justify-center px-2
                           bg-gray-100/70 border-b border-gray-200"
                style={{ height: CAP }}
              >
                {capNote}
              </div>
              <div
                // Left-aligned on a narrow screen, where the grid scrolls
                // sideways and anything centred in it starts off-screen.
                className="absolute left-[72px] right-0 flex items-center justify-start sm:justify-center px-2
                           bg-gray-100/70"
                style={{ top: dayBottom, height: CAP }}
              >
                {capNote}
              </div>

              {/* Where the day has got to. Inside the columns, not across
                  the page: it was absolutely positioned against the whole
                  document and ran edge to edge (Caroline, 2026-11-19). */}
              {nowMinutes !== null && nowMinutes > dayStart && nowMinutes < dayEnd && (
                <div
                  className="absolute left-[72px] right-0 h-px bg-red-400/70 pointer-events-none"
                  style={{ top: top(nowMinutes) }}
                >
                  {/* On the line inside the columns, not out in the time
                      rail, where it landed on top of whichever hour label
                      it happened to pass (Caroline, 2026-11-20). */}
                  <span className="absolute -top-[7px] left-1 bg-white/90 px-1 rounded text-[9px] font-semibold text-red-500">
                    now
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* A day the building does not take bookings on is covered, not
              merely un-clickable. Saturday looked like a completely free
              building: every column empty, every cell inviting
              (Caroline, 2026-11-20). */}
          {closedNote && (
            <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex items-start justify-center px-4 py-10">
              {/* The page's own card, not a warning panel. Brown text on
                  a yellow ring belonged to no other part of this site
                  (Caroline, 2026-11-20). */}
              <div className="max-w-xs rounded-xl bg-white ring-1 ring-gray-200/80
                              shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-8px_rgba(16,24,40,0.12)]
                              px-5 py-3.5 text-center">
                <p className="text-sm font-semibold text-gray-900">{closedNote.heading}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{closedNote.detail}</p>
                {/* One quiet line, not two headlines. At text-sm and
                    stacked, the phone number and the address were bigger
                    than the sentence telling you why you need them
                    (Caroline, 2026-11-20). */}
                {closedNote.contact && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs">
                    <a
                      href={`tel:${closedNote.contact.phone.replace(/\D/g, '')}`}
                      className="font-medium text-booking-700 hover:text-booking-800"
                    >{closedNote.contact.phone}</a>
                    <span className="text-gray-300">·</span>
                    <a
                      href={`mailto:${closedNote.contact.email}`}
                      className="font-medium text-booking-700 hover:text-booking-800"
                    >{closedNote.contact.email}</a>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
