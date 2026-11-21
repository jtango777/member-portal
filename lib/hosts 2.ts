// Two audiences, two addresses (Caroline, 2026-09-17):
//
//   bookings.bizhaus.com — customers: day passes, conference room bookings,
//                          My Bookings, and their login/password reset
//   members.bizhaus.com  — the member portal and admin
//
// Staging and localhost have no second hostname, so both live together
// there and none of this applies — `bookingHost` is only set in production.

/** Pages that belong to the customer-facing booking site. */
export const BOOKING_PATHS = ['/day-pass', '/book', '/my-bookings']

export const BOOKING_HOST = 'bookings.bizhaus.com'
export const PORTAL_HOST  = 'members.bizhaus.com'

export function isBookingPath(pathname: string): boolean {
  return BOOKING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/** Absolute base for links in customer emails and redirects. */
export function bookingSiteUrl(): string {
  return process.env.NEXT_PUBLIC_BOOKINGS_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? 'http://localhost:3000'
}
