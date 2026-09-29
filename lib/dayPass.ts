// Shared day-pass rules used by both the browser page and the API routes —
// kept out of the route file so the client bundle never pulls server code in.
import { getPacificDayBounds } from './utils'

export const DAY_PASS_PRICE_CENTS = 3000

// One purchase covers at most this many days — anything longer is really a
// membership conversation, not a self-serve checkout (Caroline, 2026-09-15).
export const MAX_DAY_PASS_DAYS = 10
// How far ahead a day pass can be bought. Matches the members' room-booking
// window, and stops someone locking in today's price two years out
// (Caroline, 2026-09-17).
export const MAX_DAY_PASS_MONTHS_AHEAD = 3
export const TOO_FAR_MESSAGE = `Day passes can be booked up to ${MAX_DAY_PASS_MONTHS_AHEAD} months ahead. For something further out, email hello@bizhaus.com.`

export const MAX_DAYS_MESSAGE = `${MAX_DAY_PASS_DAYS} days is the most you can book at once. Staying longer? Email hello@bizhaus.com and we'll look into options for you.`

// When self-serve cancellation closes: 9:00pm Pacific the evening before
// the pass. Back to the original rule (Caroline, 2026-09-29) after a spell
// at 9:00am on the day itself, which gave people the whole night and the
// morning to drop out. Staff can still cancel at any time via the admin
// override, refund or credit.
//
// This lived in three copies — the API route, the My Bookings page that
// decides whether to show the button, and the page copy — which is exactly
// how a rule like this drifts. One definition now.
export const CANCEL_CUTOFF_LABEL = '9:00pm the night before'

/** Epoch ms of the cancellation cutoff for a `YYYY-MM-DD` day pass date. */
export function dayPassCancelCutoff(date: string): number {
  // Pacific midnight on the day, minus three hours, is 9pm the evening
  // before, and it follows DST because getPacificDayBounds does.
  return getPacificDayBounds(date).start.getTime() - 3 * 3600000
}

export function isDayPassCancellable(date: string, now: number = Date.now()): boolean {
  return now < dayPassCancelCutoff(date)
}
