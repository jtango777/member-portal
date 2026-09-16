import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { CheckCircle, Clock, XCircle, Ban } from 'lucide-react'
import { cn, getPacificDayBounds } from '@/lib/utils'
import SignOutButton from '@/components/day-pass/SignOutButton'
import CancelDayPassButton from '@/components/day-pass/CancelDayPassButton'
import { getOrLinkBookingCustomer } from '@/lib/bookingAccounts'

export const dynamic = 'force-dynamic'

const STATUS_ICON = { confirmed: CheckCircle, pending: Clock, declined: XCircle, cancelled: Ban } as const
const STATUS_STYLES = {
  confirmed: 'text-green-600 bg-green-50',
  pending: 'text-amber-600 bg-amber-50',
  declined: 'text-red-600 bg-red-50',
  cancelled: 'text-gray-500 bg-gray-100',
} as const

type UnifiedBooking = {
  id: string
  sortKey: string
  title: string
  subtitle: string
  status: 'confirmed' | 'pending' | 'declined' | 'cancelled'
  // Only day passes are self-serve cancellable — conference room bookings
  // never are (Caroline, 2026-08-31). Present only for day-pass entries
  // that are still more than 12 hours from their start.
  cancellableConfirmationNumber?: string
  // Every booking lists its own day rows — one for a single day, several
  // for a multi-day pass. Cancelling is still whole-booking only (per-day
  // refunds aren't worth touching refund code for at this volume), so the
  // cancel control sits on the booking, labelled with how many days it
  // covers, and multi-day bookings keep the "email us for one day" line.
  days: { date: string; label: string; time: string; cancelled: boolean }[]
  cancelLabel?: string
  showSingleDayCancelNote?: boolean
}

// 12-hour cutoff measured from 9:00am Pacific on the day, matching
// /api/day-pass/cancel's own check — this only controls whether the
// button shows, the route re-checks for real before refunding anything.
function isStillCancellable(dates: string[]): boolean {
  const now = Date.now()
  return dates.every(date => {
    const nineAm = getPacificDayBounds(date).start.getTime() + 9 * 3600000
    return now < nineAm - 12 * 3600000
  })
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
    ...[...dayPassGroups.values()].map(group => {
      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
      const first = sorted[0]
      const totalCents = sorted.reduce((sum, p) => sum + p.price_cents, 0)
      // "3 days (Oct 1 – Oct 8)" read as a straight run even when the days
      // were scattered (Caroline, 2026-09-16) — only use a range when the
      // days really are back-to-back business days; otherwise just say
      // which month(s) they fall in, since every date is listed below.
      const dateLabel = sorted.length > 1
        ? (() => {
            const days = sorted.map(p => new Date(p.date + 'T12:00:00'))
            const start = days[0], end = days[days.length - 1]
            const businessDaysBetween = eachDayOfInterval({ start, end })
              .filter(d => getDay(d) !== 0 && getDay(d) !== 6).length
            if (businessDaysBetween === days.length) {
              return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')} (${days.length} days)`
            }
            const sameMonth = format(start, 'MMM yyyy') === format(end, 'MMM yyyy')
            return sameMonth
              ? `${days.length} days in ${format(start, 'MMMM yyyy')}`
              : `${days.length} days, ${format(start, 'MMM')} – ${format(end, 'MMM yyyy')}`
          })()
        : format(new Date(first.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
      const cancellable = first.status === 'confirmed' && first.confirmation_number && isStillCancellable(sorted.map(p => p.date))
      return {
        id: first.confirmation_number ?? first.id,
        sortKey: first.date,
        title: dateLabel,
        subtitle: `Day pass · ${first.locations?.name ?? 'Unknown location'}${sorted.length > 1 ? '' : ' · 9:00am – 5:00pm'} · $${(totalCents / 100).toFixed(2)}${first.confirmation_number ? ` · #${first.confirmation_number}` : ''}`,
        status: first.status as UnifiedBooking['status'],
        cancellableConfirmationNumber: cancellable ? first.confirmation_number! : undefined,
        days: sorted.map(p => ({
          date: p.date,
          label: format(new Date(p.date + 'T12:00:00'), 'EEEE, MMMM d'),
          time: '9:00am – 5:00pm',
          cancelled: p.status === 'cancelled',
        })),
        cancelLabel: sorted.length > 1 ? `Cancel all ${sorted.length} days` : 'Cancel',
        showSingleDayCancelNote: sorted.length > 1 && first.status === 'confirmed'
          && sorted[sorted.length - 1].date >= new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
      }
    }),
    ...(roomBookings ?? []).map(b => {
      const room = b.rooms as { name: string; external_name: string | null; locations: { name: string } | null } | null
      return {
        id: b.id,
        sortKey: b.start_time,
        title: format(new Date(b.start_time), 'EEEE, MMMM d, yyyy'),
        subtitle: `Room booking · ${room?.external_name ?? room?.name ?? 'Room'} · ${room?.locations?.name ?? 'Unknown location'} · ${format(new Date(b.start_time), 'h:mm a')} – ${format(new Date(b.end_time), 'h:mm a')} · #${b.id.slice(0, 8).toUpperCase()}`,
        status: b.status as UnifiedBooking['status'],
        days: [{
          date: b.start_time.slice(0, 10),
          label: format(new Date(b.start_time), 'EEEE, MMMM d'),
          time: `${format(new Date(b.start_time), 'h:mm a')} – ${format(new Date(b.end_time), 'h:mm a')}`,
          cancelled: b.status === 'cancelled',
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
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Hi, {customer.first_name}
          </h1>
          <p className="text-sm text-gray-500">{customer.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="flex items-center justify-between mb-3">
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
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {list.map(b => {
              const cancelled = b.status === 'cancelled'
              return (
                <div key={b.id} className={cn('px-5 py-4', cancelled && 'bg-gray-50/60')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className={cn('font-semibold', cancelled ? 'text-gray-500' : 'text-gray-900')}>{b.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{b.subtitle}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {b.cancellableConfirmationNumber && (
                        <CancelDayPassButton confirmationNumber={b.cancellableConfirmationNumber} label={b.cancelLabel ?? 'Cancel'} />
                      )}
                      {b.status !== 'confirmed' && (
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize', STATUS_STYLES[b.status])}>
                          {(() => { const Icon = STATUS_ICON[b.status]; return <Icon size={13} /> })()} {b.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* A single-day booking already says the date in its
                      title — no point repeating it as a one-item list. */}
                  {b.days.length > 1 && (
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {b.days.map(d => (
                      <li key={d.date} className="flex items-baseline gap-2.5 text-sm">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 translate-y-[-1px]',
                          d.cancelled ? 'bg-gray-300' : 'bg-booking-400')} />
                        <span className={d.cancelled ? 'text-gray-400' : 'text-gray-700'}>{d.label}</span>
                        <span className="text-xs text-gray-400">{d.cancelled ? 'Cancelled' : d.time}</span>
                      </li>
                    ))}
                  </ul>
                  )}

                  {b.showSingleDayCancelNote && (
                    <div className="text-xs text-gray-400 mt-2.5">
                      Need to cancel just one day? Email <a href="mailto:hello@bizhaus.com" className="underline hover:text-gray-600">hello@bizhaus.com</a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

    </div>
  )
}
