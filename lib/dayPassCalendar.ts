// Calendar links for a day pass, shared by the post-checkout confirmation
// screen (app/day-pass/page.tsx), the My Bookings cards, and the
// confirmation email, which all offer the same options. Lifted out of the
// day pass page unchanged on 2026-09-30 so the bookings list could reuse it
// instead of growing a second copy of the same stamp maths.
//
// The stamp and .ics building moved again on 2026-11-21, into lib/calendar,
// when room bookings needed the same thing. What is left here is the day
// pass's own shape: 9 to 5, one event per date, named for the location.
import { getPacificDayBounds } from './utils'
import { buildIcs, googleCalendarUrl, type CalendarEvent } from './calendar'

const PROD_ID = '-//BizHaus//Day Pass//EN'

// Calendar times for a day pass: 9am to 5pm Pacific on each date.
export function dayPassDayBounds(date: string): { start: Date; end: Date } {
  const dayStart = getPacificDayBounds(date).start.getTime()
  return { start: new Date(dayStart + 9 * 3600000), end: new Date(dayStart + 17 * 3600000) }
}

type DayPassDetails = {
  locationName: string
  address: string
  confirmationNumber: string
}

function dayPassEvent(d: DayPassDetails, date: string): CalendarEvent {
  const { start, end } = dayPassDayBounds(date)
  return {
    uid: `daypass-${d.confirmationNumber}-${date}@bizhaus.com`,
    title: `BizHaus Day Pass (${d.locationName})`,
    start, end,
    location: d.address,
    details: `Confirmation #${d.confirmationNumber}`,
  }
}

/**
 * Google's "add to calendar" URL for one day. Google's template only takes a
 * single event, so a multi-day booking uses the .ics download instead.
 */
export function dayPassGoogleCalendarUrl(d: DayPassDetails & { date: string }): string {
  return googleCalendarUrl(dayPassEvent(d, d.date))
}

/** One .ics file holding every day of the booking, for Apple and Outlook. */
export function buildDayPassIcs({ dates, ...d }: DayPassDetails & { dates: string[] }): string {
  return buildIcs(dates.map(date => dayPassEvent(d, date)), PROD_ID)
}

/** Browser only: hands the .ics straight to the operating system. */
export function downloadDayPassIcs(event: DayPassDetails & { dates: string[] }) {
  const ics = buildDayPassIcs(event)
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url; a.download = `bizhaus-day-pass-${event.confirmationNumber}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
