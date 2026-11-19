/**
 * What to offer somebody when the room they picked cannot do what they
 * asked for.
 *
 * The booking page used to answer "this room is already booked for part of
 * that day, turn off All day and pick times that are free", which states
 * the problem and hands the customer the search. Often another room at the
 * same location was free the whole time (Caroline, 2026-11-18).
 *
 * Pure functions, no fetching and no React, so the ordering rules can be
 * read and argued with on their own.
 */

/** A half-hour slot value as the booking page writes them: "9:00", "14:30". */
export type Slot = string

export type FreeBlock = { start: Slot; end: Slot }

export type SuggestableRoom = {
  id: string
  external_name: string
  capacity: number
  price_per_hour: number
}

export function slotMinutes(s: Slot): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

function slotLabel(s: Slot): string {
  const [h, m] = s.split(':').map(Number)
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * The runs of free time in a day, from the slots that are taken.
 *
 * `startSlots` is every bookable half hour of the day in order; a block
 * ends at the start of the next slot after its last free one, which is
 * why the close time is passed in rather than inferred.
 */
export function freeBlocks(startSlots: Slot[], blocked: Slot[], closeSlot: Slot): FreeBlock[] {
  const taken = new Set(blocked)
  const out: FreeBlock[] = []
  let runStart: Slot | null = null

  startSlots.forEach((slot, i) => {
    const free = !taken.has(slot)
    if (free && runStart === null) runStart = slot
    const nextTaken = i + 1 >= startSlots.length || taken.has(startSlots[i + 1])
    if (free && nextTaken && runStart !== null) {
      out.push({ start: runStart, end: startSlots[i + 1] ?? closeSlot })
      runStart = null
    }
  })
  return out
}

export function blockHours(b: FreeBlock): number {
  return (slotMinutes(b.end) - slotMinutes(b.start)) / 60
}

export function longestBlock(blocks: FreeBlock[]): FreeBlock | null {
  return blocks.reduce<FreeBlock | null>(
    (best, b) => (!best || blockHours(b) > blockHours(best) ? b : best), null)
}

/**
 * What a room's free time amounts to, in the words somebody would use.
 *
 * Two blocks are worth spelling out, because "free 9 to 1 and 2:30 to 5"
 * is a day most people can work with. Three or more becomes noise, so it
 * says how much there is and lets the room's own page show the detail.
 */
export function describeFreeTime(blocks: FreeBlock[], wholeDayHours: number): string {
  if (!blocks.length) return 'fully booked'
  const total = blocks.reduce((n, b) => n + blockHours(b), 0)
  if (blocks.length === 1 && total >= wholeDayHours) return 'free all day'
  if (blocks.length === 1) return `free ${slotLabel(blocks[0].start)}–${slotLabel(blocks[0].end)}`
  if (blocks.length === 2) {
    return `free ${slotLabel(blocks[0].start)}–${slotLabel(blocks[0].end)}`
      + ` and ${slotLabel(blocks[1].start)}–${slotLabel(blocks[1].end)}`
  }
  return `${total} hours free, in ${blocks.length} parts`
}

export type Suggestion = {
  room: SuggestableRoom
  blocks: FreeBlock[]
  /** The block to put them in if they take this room. */
  best: FreeBlock
  summary: string
  /** Seats fewer people than the room they were looking at. */
  smaller: boolean
}

/**
 * Other rooms worth offering, best first.
 *
 * Ordering is deliberately not "closest capacity", which treats bigger
 * and smaller as equally good. They are not: somebody looking at a room
 * for sixteen may have sixteen people coming, and a room for five is no
 * use to them at any price. So rooms that seat at least as many come
 * first, smallest of those first, since that is the closest fit without
 * being too small. Rooms that seat fewer follow, largest first, each one
 * marked as smaller so the trade is visible rather than buried.
 *
 * Within that, a room that can cover the whole request beats one that can
 * only cover part of it.
 */
export function rankSuggestions(opts: {
  chosen: SuggestableRoom
  rooms: SuggestableRoom[]
  blockedByRoom: Record<string, Slot[]>
  startSlots: Slot[]
  closeSlot: Slot
  /** The hours they asked for, so a room that covers them sorts first. */
  wantHours: number
  wholeDayHours: number
  /**
   * Ignore rooms with less than this much free in a row.
   *
   * Half an hour in a $100 room is not an answer to "I wanted the day",
   * it is a line that makes the list look longer than it is
   * (Caroline, 2026-11-18).
   */
  minHours?: number
}): Suggestion[] {
  const { chosen, rooms, blockedByRoom, startSlots, closeSlot, wantHours, wholeDayHours } = opts
  const minHours = opts.minHours ?? 1

  const candidates: Suggestion[] = []
  for (const room of rooms) {
    if (room.id === chosen.id) continue
    const blocks = freeBlocks(startSlots, blockedByRoom[room.id] ?? [], closeSlot)
    const best = longestBlock(blocks)
    if (!best || blockHours(best) < minHours) continue
    candidates.push({
      room,
      blocks,
      best,
      summary: describeFreeTime(blocks, wholeDayHours),
      smaller: room.capacity < chosen.capacity,
    })
  }

  return candidates.sort((a, b) => {
    // Covers what they asked for, before anything that only covers part.
    const aCovers = blockHours(a.best) >= wantHours
    const bCovers = blockHours(b.best) >= wantHours
    if (aCovers !== bCovers) return aCovers ? -1 : 1

    // Big enough before too small.
    if (a.smaller !== b.smaller) return a.smaller ? 1 : -1

    // Among the big enough, the snuggest fit. Among the too small, the
    // largest, which is the least bad compromise.
    return a.smaller
      ? b.room.capacity - a.room.capacity
      : a.room.capacity - b.room.capacity
  })
}

/**
 * The inverse of freeBlocks: somebody else's time, merged into runs.
 *
 * The grid draws one block per booking rather than one per half hour, so
 * contiguous taken slots have to come back joined up. A two hour meeting
 * drawn as four grey cells reads as four meetings (Caroline, 2026-11-19).
 */
export function busyBlocks(startSlots: Slot[], taken: Slot[], closeSlot: Slot): FreeBlock[] {
  const isTaken = new Set(taken)
  const out: FreeBlock[] = []
  let runStart: Slot | null = null

  startSlots.forEach((slot, i) => {
    const busy = isTaken.has(slot)
    if (busy && runStart === null) runStart = slot
    const nextFree = i + 1 >= startSlots.length || !isTaken.has(startSlots[i + 1])
    if (busy && nextFree && runStart !== null) {
      out.push({ start: runStart, end: startSlots[i + 1] ?? closeSlot })
      runStart = null
    }
  })
  return out
}
