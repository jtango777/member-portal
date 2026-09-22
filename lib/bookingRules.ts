// Shared rules for public conference room bookings (/book).
//
// These live in one place so the page and BOTH API routes agree. Testing on
// 2026-09-22 found the page was the only thing enforcing them: anyone who
// edited the web address could book a Saturday, a date in the past, 7am, a
// 15-minute slot, or midnight to 11:30pm for $2,350. The rules below are now
// checked on the server too (Caroline, 2026-09-22).
//
// Client-safe: no server-only imports, so the booking page can use the same
// functions the routes do.
import { CLOSURE_DAYS, closureName } from '@/lib/holidays'

/** Bookable hours, Pacific. Anything outside these is arranged by phone. */
export const OPEN_MINUTES  = 9 * 60    // 9:00 AM
export const CLOSE_MINUTES = 17 * 60   // 5:00 PM

/** Shortest bookable slot, and the increment every time must land on. */
export const MIN_BOOKING_MINUTES = 30

/** How far ahead the public can book a room. Day passes are 3 months;
 *  rooms get longer because offsites are planned further out
 *  (Caroline, 2026-09-22). */
export const MAX_BOOKING_MONTHS_AHEAD = 6

export const CONTACT_LINE = 'For anything outside those hours, call (310) 870-1730 or email bookings@bizhaus.com.'

const PT = 'America/Los_Angeles'

export function pacificToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function pacificNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: PT, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  return h * 60 + m
}

/** "9:30" → 570. Returns null for anything that isn't a real time. */
export function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '')
  if (!match) return null
  const h = Number(match[1]), m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** The last date that can be booked, as YYYY-MM-DD in Pacific time. */
export function lastBookableDate(): string {
  const today = new Date(pacificToday() + 'T12:00:00')
  const limit = new Date(today)
  limit.setMonth(limit.getMonth() + MAX_BOOKING_MONTHS_AHEAD)
  return limit.toISOString().slice(0, 10)
}

export function isWeekendDate(date: string): boolean {
  const day = new Date(date + 'T12:00:00').getDay()
  return day === 0 || day === 6
}

/** Why this date can't be booked, or null if it can. Dates only — the time
 *  checks live in roomBookingError below. Used by the date picker too. */
export function dateUnavailableReason(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Please choose a date.'
  if (date < pacificToday()) return 'That date has already passed.'
  if (isWeekendDate(date)) return 'Weekend bookings are arranged by phone. Call (310) 870-1730 or email bookings@bizhaus.com.'
  if (CLOSURE_DAYS[date]) return `We're closed on ${closureName(date)}. Please pick another day.`
  if (date > lastBookableDate()) return `Rooms can be booked up to ${MAX_BOOKING_MONTHS_AHEAD} months ahead. For something further out, email bookings@bizhaus.com.`
  return null
}

/**
 * The single check both /api/book routes run. Returns an error message to
 * show the customer, or null when the booking is allowed.
 */
export function roomBookingError(date: string, start: string, end: string): string | null {
  const dateProblem = dateUnavailableReason(date)
  if (dateProblem) return dateProblem

  const startMin = toMinutes(start)
  const endMin   = toMinutes(end)
  if (startMin === null || endMin === null) return 'Please choose a start and end time.'

  if (startMin % MIN_BOOKING_MINUTES !== 0 || endMin % MIN_BOOKING_MINUTES !== 0) {
    return 'Bookings start and end on the hour or half hour.'
  }
  if (endMin - startMin < MIN_BOOKING_MINUTES) {
    return `Bookings are at least ${MIN_BOOKING_MINUTES} minutes long.`
  }
  if (startMin < OPEN_MINUTES || endMin > CLOSE_MINUTES) {
    return `Rooms are bookable between 9:00 AM and 5:00 PM. ${CONTACT_LINE}`
  }
  if (date === pacificToday() && startMin <= pacificNowMinutes()) {
    return 'That start time has already passed today. Please pick a later time.'
  }
  return null
}
