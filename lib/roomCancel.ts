// When a customer can still cancel their own conference room booking.
//
// Rooms used to be flatly non-refundable with no self-serve cancellation
// at all; the only way out was emailing us. They can now be cancelled up
// to 9:00 PM Pacific the night before, the same cutoff day passes use, and
// what comes back is credit rather than money (Caroline, 2026-11-20).
//
// The credit is deliberately not a balance anywhere. Nothing is written to
// a credits table, nothing shows on My Bookings, and nothing can be spent
// online. It exists only as a sentence in the cancellation email naming an
// amount and a confirmation number, and it is redeemed by ringing us and
// quoting that number. Keeping it off the site is the point: staff decide
// what it is worth against a new booking.

import { getPacificDayBounds, pacificDateKey } from './utils'

export const ROOM_CANCEL_CUTOFF_LABEL = '9:00 PM the night before'

/** Epoch ms of the cutoff for a booking starting at `startTime`. */
export function roomCancelCutoff(startTime: string | Date): number {
  // Pacific midnight on the day of the booking, less three hours, is 9 PM
  // the evening before, and it follows daylight saving because
  // getPacificDayBounds does.
  const day = pacificDateKey(new Date(startTime))
  return getPacificDayBounds(day).start.getTime() - 3 * 3600000
}

export function isRoomBookingCancellable(startTime: string | Date, now: number = Date.now()): boolean {
  return now < roomCancelCutoff(startTime)
}
