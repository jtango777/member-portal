// Calendar entries for anything we confirm by email: day passes and
// conference room bookings (Joe's list, 2026-11-21).
//
// This was day-pass-only and lived in dayPassCalendar.ts, which built the
// stamps and the .ics inline. Rooms needed the same thing, so the maths
// moved here and dayPassCalendar now calls into it rather than carrying a
// second copy.
//
// Everything is handed in as a real Date and written as a UTC stamp
// (20261121T170000Z). That is what Google's template URL and .ics files
// both take, and it is the one format with no timezone to get wrong.
// Nothing here formats a time for display, deliberately: Vercel runs UTC
// and formatting a stamp on the server has emailed customers the wrong
// time before.

export type CalendarEvent = {
  /** Stable per booking per day, so re-adding updates rather than duplicates. */
  uid: string
  title: string
  start: Date
  end: Date
  location: string
  details: string
}

/** A Date as the compact UTC stamp both Google and .ics take. */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Google's "add to calendar" URL. Their template carries exactly one
 * event, so anything spanning several days uses the .ics instead.
 */
export function googleCalendarUrl(e: CalendarEvent): string {
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(e.title)}`
    + `&dates=${utcStamp(e.start)}/${utcStamp(e.end)}`
    + `&location=${encodeURIComponent(e.location)}`
    + `&details=${encodeURIComponent(e.details)}`
}

/**
 * One .ics holding every event given, for Apple Calendar and Outlook.
 *
 * Commas carry meaning in an .ics value and have to be escaped, or a
 * street address silently truncates at the first comma.
 */
export function buildIcs(events: CalendarEvent[], prodId = '-//BizHaus//Bookings//EN'): string {
  const now = utcStamp(new Date())
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const blocks = events.map(e => [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${now}`, `DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.details)}`,
    'END:VEVENT',
  ].join('\r\n'))
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, ...blocks, 'END:VCALENDAR'].join('\r\n')
}

// The .ics is attached to the email rather than linked, which is what Gmail,
// Apple Mail and Outlook already know how to offer an "add" button for, and
// needs no public endpoint handing out booking details to anyone holding a
// confirmation number. That attachment is built in lib/email.ts: it needs
// Buffer, and this file is also imported by the day pass page in the
// browser, where Buffer does not exist.

/**
 * The line in the email body. Deliberately plain: the day pass email is a
 * letter and the room receipt is a styled receipt, and this sits in both,
 * inheriting each one's font rather than fighting it.
 */
export function calendarBlockHtml(googleUrl: string | null, dayCount = 1): string {
  const google = googleUrl
    ? `<a href="${googleUrl}" style="color:#4f9645;text-decoration:none;font-weight:600;">Google Calendar</a>, or the`
    : 'The'
  const what = dayCount > 1 ? `invite covering all ${dayCount} days is` : 'invite is'
  return `
      <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
        <strong style="color:#334155;">Add to your calendar:</strong>
        ${google} ${what} attached for Apple Calendar and Outlook.
      </p>`
}
