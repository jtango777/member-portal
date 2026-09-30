'use client'

import { dayPassGoogleCalendarUrl, downloadDayPassIcs } from '@/lib/dayPassCalendar'

// The same two calendar options the post-checkout confirmation screen
// offers, as a small client island so My Bookings can stay a server
// component (Caroline, 2026-09-30: people open that page on the way in, and
// the confirmation screen is the one place they'd already seen this).
//
// Google's template URL only carries one event, so a multi-day booking gets
// the .ics download only, which holds every day in one file. The .ics has to
// be built in the browser because it is handed straight to the operating
// system rather than fetched from a URL.
export default function AddToCalendarLinks({ locationName, address, confirmationNumber, dates }: {
  locationName: string
  address: string
  confirmationNumber: string
  dates: string[]
}) {
  if (!dates.length) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium">
      {dates.length === 1 && (
        <a
          href={dayPassGoogleCalendarUrl({ locationName, address, confirmationNumber, date: dates[0] })}
          target="_blank" rel="noopener noreferrer"
          className="text-booking-600 hover:text-booking-700"
        >
          Google Calendar
        </a>
      )}
      <button
        type="button"
        onClick={() => downloadDayPassIcs({ locationName, address, confirmationNumber, dates })}
        className="text-booking-600 hover:text-booking-700"
      >
        {dates.length > 1 ? `Add all ${dates.length} days (Apple, Outlook, Google)` : 'Apple or Outlook'}
      </button>
    </div>
  )
}
