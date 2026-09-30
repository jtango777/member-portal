import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { CheckCircle, Clock, XCircle, Ban, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDayPassCancellable } from '@/lib/dayPass'
import { DAY_PASS_LOCATIONS_BY_NAME, directionsUrl } from '@/lib/locations'
import SignOutButton from '@/components/day-pass/SignOutButton'
import CancelDayPassButton from '@/components/day-pass/CancelDayPassButton'
import AddToCalendarLinks from '@/components/day-pass/AddToCalendarLinks'
import { getOrLinkBookingCustomer } from '@/lib/bookingAccounts'

export const dynamic = 'force-dynamic'

const STATUS_ICON = { confirmed: CheckCircle, pending: Clock, declined: XCircle, cancelled: Ban } as const
const STATUS_STYLES = {
  confirmed: 'text-green-600 bg-green-50',
  pending: 'text-amber-600 bg-amber-50',
  declined: 'text-red-600 bg-red-50',
  cancelled: 'text-gray-500 bg-gray-100',
} as const

// A quiet control that still looks like something you press, because it is
// the only irreversible thing on the page. It used to be plain grey text at
// the same weight as the price and the reference number, so it read as a
// label rather than a button (Caroline, 2026-09-30).
const CANCEL_BUTTON = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-600 '
  + 'hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors'

type BookingDay = {
  date: string
  label: string
  time: string
  cancelled: boolean
  cancellable: boolean
  amount?: string
}

type UnifiedBooking = {
  id: string
  sortKey: string
  // Someone opens this page to answer one of three questions: where am I
  // going, what do I show when I arrive, and how do I cancel. So the card
  // leads with the location and the date, hands over the confirmation
  // number at a size you can actually read out at a desk, and keeps the
  // address, directions and calendar links that the checkout confirmation
  // screen and the confirmation email already had (Caroline, 2026-09-30).
  kind: 'day-pass' | 'room'
  locationName: string
  // What was booked, above the location: "Day pass", "3 day passes", or the
  // room's own name for a conference room booking.
  what: string
  dateLabel: string
  amount: string
  hours: string
  reference?: string
  status: 'confirmed' | 'pending' | 'declined' | 'cancelled'
  // Street address and door code come from lib/locations.ts, not the
  // database, which has no columns for either. Missing for a location name
  // that isn't one of the three day pass locations, so every use is guarded.
  address?: string
  // Only day passes are self-serve cancellable — conference room bookings
  // never are (Caroline, 2026-08-31). Present only for day-pass entries
  // that are still before their 9pm-night-before cancellation cutoff.
  cancellableConfirmationNumber?: string
  // Every booking lists its own day rows — one for a single day, several
  // for a multi-day pass. Both the per-day cancel and the whole-booking
  // cancel route through CancelDayPassButton.
  days: BookingDay[]
  cancelLabel?: string
  // Days that can still be cancelled — what "Cancel all" actually covers,
  // since a day that has already started can't be.
  cancellableDates?: string[]
  // Days still worth putting in a calendar, so a partly cancelled booking
  // doesn't offer to add the days it just refunded.
  calendarDates?: string[]
}

// Cutoff lives in lib/dayPass.ts — this only controls whether the button
// shows; /api/day-pass/cancel re-checks for real before refunding anything.
function isStillCancellable(date: string): boolean {
  return isDayPassCancellable(date)
}

export default async function DayPassAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/my-bookings/login')

  // RLS scopes all of these to the logged-in customer's own rows (see
  // migrations 044/046) — no admin bypass needed or wanted here.
  // A staff/member login that reached here without a booking account gets
  // one linked now, instead of being bounced back to /day-pass.
  const customer = await getOrLinkBookingCustomer(user.id, true)
  if (!customer) redirect('/day-pass')

  const [{ data: dayPasses }, { data: roomBookings }] = await Promise.all([
    supabase
      .from('day_passes')
      .select('*, locations(id, name)')
      .eq('customer_id', user.id)
      .order('date', { ascending: false }),
    supabase
      .from('external_bookings')
      .select('*, rooms(name, external_name, locations(name))')
      .eq('customer_id', user.id)
      .order('start_time', { ascending: false }),
  ])

  // A multi-day purchase creates one day_passes row per day, all sharing
  // one confirmation number — group them back into a single line here so
  // a 3-day purchase reads as one booking, not three.
  const dayPassGroups = new Map<string, NonNullable<typeof dayPasses>>()
  for (const pass of dayPasses ?? []) {
    const key = pass.confirmation_number ?? pass.id
    dayPassGroups.set(key, [...(dayPassGroups.get(key) ?? []), pass])
  }

  // Day passes and /book room bookings are different shapes — same shared
  // account, so unify them into one list here rather than showing two
  // disconnected sections.
  const bookings: UnifiedBooking[] = [
    ...[...dayPassGroups.values()].map((group): UnifiedBooking => {
      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
      // Cancelling one day of a multi-day purchase used to take the whole
      // card down with it: the card's status, date and total were all read
      // off the earliest row, so dropping day one made the booking look
      // cancelled, worth its original total, and filed under Past — while
      // the remaining day was still very much booked and paid for
      // (Caroline, 2026-09-30, caught on the first real partial cancel).
      //
      // The card now summarises the days that are still live and lists the
      // cancelled ones underneath as a record. It stays ONE card, because
      // it is one purchase, one confirmation number and one payment; a
      // second card would imply a booking that exists nowhere in Stripe or
      // QuickBooks.
      const live = sorted.filter(p => p.status !== 'cancelled')
      const headline = live.length ? live : sorted
      const first = headline[0]
      const totalCents = headline.reduce((sum, p) => sum + p.price_cents, 0)
      // "3 days (Oct 1 – Oct 8)" read as a straight run even when the days
      // were scattered (Caroline, 2026-09-16) — only use a range when the
      // days really are back-to-back business days; otherwise just say
      // which month(s) they fall in, since every date is listed below.
      const dateLabel = headline.length > 1
        ? (() => {
            const days = headline.map(p => new Date(p.date + 'T12:00:00'))
            const start = days[0], end = days[days.length - 1]
            const businessDaysBetween = eachDayOfInterval({ start, end })
              .filter(d => getDay(d) !== 0 && getDay(d) !== 6).length
            if (businessDaysBetween === days.length) {
              return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
            }
            const sameMonth = format(start, 'MMM yyyy') === format(end, 'MMM yyyy')
            return sameMonth
              ? `${days.length} days in ${format(start, 'MMMM yyyy')}`
              : `${days.length} days, ${format(start, 'MMM')} – ${format(end, 'MMM yyyy')}`
          })()
        : format(new Date(first.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
      const cancellableDates = sorted
        .filter(p => p.status === 'confirmed' && isStillCancellable(p.date))
        .map(p => p.date)
      const locationName = first.locations?.name ?? 'Day pass'
      const loc = DAY_PASS_LOCATIONS_BY_NAME[locationName]
      return {
        id: first.confirmation_number ?? first.id,
        sortKey: first.date,
        kind: 'day-pass',
        locationName,
        what: headline.length > 1 ? `${headline.length} day passes` : 'Day pass',
        dateLabel,
        amount: `$${(totalCents / 100).toFixed(2)}`,
        hours: headline.length > 1 ? '9:00am – 5:00pm each day' : '9:00am – 5:00pm',
        reference: first.confirmation_number ?? undefined,
        status: first.status as UnifiedBooking['status'],
        address: loc?.address,
        cancellableConfirmationNumber: cancellableDates.length && first.confirmation_number ? first.confirmation_number : undefined,
        cancellableDates,
        calendarDates: live.map(p => p.date),
        days: sorted.map(p => ({
          date: p.date,
          label: format(new Date(p.date + 'T12:00:00'), 'EEEE, MMMM d'),
          time: '9:00am – 5:00pm',
          cancelled: p.status === 'cancelled',
          cancellable: p.status === 'confirmed' && isStillCancellable(p.date),
          // What this one day actually cost. The confirm prompt used to say
          // a hardcoded $30, which would lie the moment the price changed
          // in admin (Caroline, 2026-09-30).
          amount: `$${(p.price_cents / 100).toFixed(2)}`,
        })),
        cancelLabel: cancellableDates.length > 1
          ? (cancellableDates.length === live.length ? `Cancel all ${cancellableDates.length} days` : `Cancel ${cancellableDates.length} days`)
          : 'Cancel booking',
      }
    }),
    ...(roomBookings ?? []).map((b): UnifiedBooking => {
      const room = b.rooms as { name: string; external_name: string | null; locations: { name: string } | null } | null
      const locationName = room?.locations?.name ?? 'Room booking'
      const loc = DAY_PASS_LOCATIONS_BY_NAME[locationName]
      return {
        id: b.id,
        sortKey: b.start_time,
        kind: 'room',
        locationName,
        what: room?.external_name ?? room?.name ?? 'Room booking',
        dateLabel: format(new Date(b.start_time), 'EEEE, MMMM d, yyyy'),
        amount: '',
        hours: `${format(new Date(b.start_time), 'h:mm a')} – ${format(new Date(b.end_time), 'h:mm a')}`,
        reference: b.id.slice(0, 8).toUpperCase(),
        status: b.status as UnifiedBooking['status'],
        address: loc?.address,
        // No door code on a room booking even at Marina: #6192 is the day
        // pass code, and a room booking is let in by whoever is hosting it.
        days: [{
          date: b.start_time.slice(0, 10),
          label: format(new Date(b.start_time), 'EEEE, MMMM d'),
          time: `${format(new Date(b.start_time), 'h:mm a')} – ${format(new Date(b.end_time), 'h:mm a')}`,
          cancelled: b.status === 'cancelled',
          cancellable: false,
        }],
      }
    }),
  ]

  // Soonest upcoming first, past bookings pushed to the bottom (most recent
  // past first) — matches how Industrious lists bookings, rather than the
  // previous furthest-future-first order.
  const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  bookings.sort((a, b) => {
    const aUpcoming = a.sortKey >= todayPacific
    const bUpcoming = b.sortKey >= todayPacific
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
    return aUpcoming ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey)
  })

  // Anything still ahead and not cancelled is what people came here for;
  // cancelled and finished bookings drop into Past.
  const upcoming = bookings.filter(b => b.sortKey >= todayPacific && b.status !== 'cancelled')
  const past = bookings.filter(b => !(b.sortKey >= todayPacific && b.status !== 'cancelled'))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Hi, {customer.first_name}
          </h1>
          <p className="text-sm text-gray-500 truncate">{customer.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Bookings</h2>
        <div className="flex items-center gap-4 text-sm font-medium">
          <a href="/day-pass" className="text-booking-600 hover:text-booking-700">+ Day Pass</a>
          <a href="/book" className="text-booking-600 hover:text-booking-700">+ Room Booking</a>
        </div>
      </div>

      {!bookings.length && (
        <div className="border border-dashed border-gray-200 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
          No bookings yet.
        </div>
      )}

      {([['Upcoming', upcoming], ['Past', past]] as const).map(([heading, list]) => list.length > 0 && (
        <div key={heading} className="mb-8 last:mb-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{heading}</div>
          {/* One card per booking. These used to share a single bordered
              container with dividers between them, so two separate
              purchases read as one card with two rows (Caroline,
              2026-09-30). */}
          <div className="flex flex-col gap-4">
            {list.map(b => <BookingCard key={b.id} b={b} isPast={heading === 'Past'} />)}
          </div>
        </div>
      ))}

    </div>
  )
}

function BookingCard({ b, isPast }: { b: UnifiedBooking; isPast: boolean }) {
  const cancelled = b.status === 'cancelled'
  const muted = isPast || cancelled
  // The arrival instructions are only useful for something still ahead of
  // you. A finished or cancelled booking is a record, so it keeps the
  // location, dates and reference number and drops the map and calendar.
  const showInstructions = !muted

  return (
    <div className={cn('rounded-xl border border-gray-200 overflow-hidden', muted ? 'bg-gray-50/60' : 'bg-white')}>
      <div className="px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{b.what}</div>
          <div className={cn('text-lg font-semibold leading-tight mt-0.5', muted ? 'text-gray-500' : 'text-gray-900')}>
            {b.locationName}
          </div>
          <div className={cn('text-sm mt-0.5', muted ? 'text-gray-400' : 'text-gray-600')}>{b.dateLabel}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {b.amount && (
            <div className={cn('text-base font-semibold whitespace-nowrap', muted ? 'text-gray-400' : 'text-gray-900')}>{b.amount}</div>
          )}
          {b.status !== 'confirmed' && (
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize', STATUS_STYLES[b.status])}>
              {(() => { const Icon = STATUS_ICON[b.status]; return <Icon size={13} /> })()} {b.status}
            </span>
          )}
        </div>
      </div>

      {/* Every day of the booking, as full rows rather than the little pills
          multi-day bookings used to get. A single-day and a multi-day pass
          now read as the same thing with more or fewer rows. */}
      {b.days.length > 1 && (
        <div className="mx-4 sm:mx-5 mb-4 rounded-lg border border-gray-100 divide-y divide-gray-100">
          {b.days.map(d => (
            <div key={d.date} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={cn('text-sm font-medium', d.cancelled || muted ? 'text-gray-400' : 'text-gray-900')}>
                  {format(new Date(d.date + 'T12:00:00'), 'EEE, MMM d')}
                  {d.cancelled && <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-gray-400">cancelled</span>}
                </div>
                <div className={cn('text-[13px]', d.cancelled || muted ? 'text-gray-400' : 'text-gray-500')}>{d.time}</div>
              </div>
              {d.cancellable && b.cancellableConfirmationNumber && (
                <CancelDayPassButton
                  confirmationNumber={b.cancellableConfirmationNumber}
                  dates={[d.date]}
                  label="Cancel"
                  confirmLabel={`Cancel ${format(new Date(d.date + 'T12:00:00'), 'MMM d')} & refund ${d.amount ?? 'this day'}?`}
                  className={CANCEL_BUTTON}
                  wrapperClassName="h-9 flex-shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Where you're going, and getting it into your calendar. Same
          details, and the same link building, as the confirmation screen
          you saw right after paying (app/day-pass/page.tsx). */}
      {showInstructions && (b.address || b.kind === 'day-pass') && (
        <div className="mx-4 sm:mx-5 mb-4 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-y-0 text-sm">
          <div className="py-2.5 border-t border-gray-100 text-gray-500">When</div>
          <div className="py-2.5 border-t border-gray-100 text-gray-900">{b.hours}</div>
          {b.address && (
            <>
              <div className="py-2.5 border-t border-gray-100 text-gray-500">Where</div>
              <div className="py-2.5 border-t border-gray-100">
                <div className="text-gray-900">{b.address}</div>
                <a
                  href={directionsUrl(b.address)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[13px] font-medium text-booking-600 hover:text-booking-700"
                >
                  <MapPin size={13} /> Get directions →
                </a>
              </div>
            </>
          )}
          {b.kind === 'day-pass' && b.address && b.reference && (b.calendarDates?.length ?? 0) > 0 && (
            <>
              <div className="py-2.5 border-t border-gray-100 text-gray-500">Calendar</div>
              <div className="py-2.5 border-t border-gray-100">
                <AddToCalendarLinks
                  locationName={b.locationName}
                  address={b.address}
                  confirmationNumber={b.reference}
                  dates={b.calendarDates!}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer: the reference number for anyone quoting it to us, and the
          one irreversible control on the card, kept away from everything
          else. */}
      <div className={cn(
        'px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3',
        muted ? 'bg-transparent' : 'bg-gray-50/70'
      )}>
        <span className="text-xs text-gray-400 tracking-wide font-mono truncate">
          {b.reference ? `#${b.reference}` : ''}
        </span>
        {b.cancellableConfirmationNumber && (
          <CancelDayPassButton
            confirmationNumber={b.cancellableConfirmationNumber}
            label={b.cancelLabel ?? 'Cancel booking'}
            dates={b.days.length > 1 ? b.cancellableDates : undefined}
            confirmLabel={b.days.length > 1
              ? `Cancel ${b.cancellableDates?.length} ${b.cancellableDates?.length === 1 ? 'day' : 'days'} & refund?`
              : 'Cancel & refund?'}
            className={CANCEL_BUTTON}
            wrapperClassName="h-9 flex-shrink-0"
          />
        )}
      </div>
    </div>
  )
}
