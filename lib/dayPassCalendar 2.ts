// Calendar links for a day pass, shared by the post-checkout confirmation
// screen (app/day-pass/page.tsx) and the My Bookings cards, which offer the
// same two options. Lifted out of the day pass page unchanged on
// 2026-09-30 so the bookings list could reuse it instead of growing a
// second copy of the same stamp maths.
import { getPacificDayBounds } from './utils'

// Calendar times for a day pass: 9am to 5pm Pacific on each date, as UTC
// stamps like 20261030T160000Z (what both Google links and .ics files take).
export function dayPassUtcStamps(date: string) {
  const dayStart = getPacificDayBounds(date).start.getTime()
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { start: stamp(dayStart + 9 * 3600000), end: stamp(dayStart + 17 * 3600000) }
}

type CalendarEvent = {
  locationName: string
  address: string
  confirmationNumber: string
}

/**
 * Google's "add to calendar" URL for one day. Google's template only takes a
 * single event, so a multi-day booking uses the .ics download instead.
 */
export function dayPassGoogleCalendarUrl({ locationName, address, confirmationNumber, date }: CalendarEvent & { date: string }): string {
  const { start, end } = dayPassUtcStamps(date)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`BizHaus Day Pass (${locationName})`)}&dates=${start}/${end}&location=${encodeURIComponent(address)}&details=${encodeURIComponent(`Confirmation #${confirmationNumber}`)}`
}

/** One .ics file holding every day of the booking, for Apple and Outlook. */
export function buildDayPassIcs({ locationName, address, confirmationNumber, dates }: CalendarEvent & { dates: string[] }): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const events = dates.map(d => {
    const { start, end } = dayPassUtcStamps(d)
    return [
      'BEGIN:VEVENT',
      `UID:daypass-${confirmationNumber}-${d}@bizhaus.com`,
      `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:BizHaus Day Pass (${locationName})`,
      `LOCATION:${address.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Confirmation #${confirmationNumber}`,
      'END:VEVENT',
    ].join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BizHaus//Day Pass//EN', ...events, 'END:VCALENDAR'].join('\r\n')
}

/** Browser only: hands the .ics straight to the operating system. */
export function downloadDayPassIcs(event: CalendarEvent & { dates: string[] }) {
  const ics = buildDayPassIcs(event)
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url; a.download = `bizhaus-day-pass-${event.confirmationNumber}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
