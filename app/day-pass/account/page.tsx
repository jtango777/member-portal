import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { CheckCircle, Clock, XCircle, Ban } from 'lucide-react'
import { cn, getPacificDayBounds } from '@/lib/utils'
import { LOCATION_PHOTOS } from '@/lib/locationPhotos'
import SignOutButton from '@/components/day-pass/SignOutButton'
import CancelDayPassButton from '@/components/day-pass/CancelDayPassButton'

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
  // Day pass entries only — a small thumbnail of that location's open desk
  // space, so the list isn't pure text. Room bookings don't get one (each
  // is a specific room, not a location, and doesn't have per-room photos
  // wired up here) — scoped to day-pass rows only for now.
  photo?: { src: string; position?: string }
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
  if (!user) redirect('/day-pass/login')

  // RLS scopes all of these to the logged-in customer's own rows (see
  // migrations 044/046) — no admin bypass needed or wanted here.
  const { data: customer } = await supabase
    .from('booking_customers')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .single()

  // Not a booking_customers account (e.g. a member's own login) — nothing
  // to show here.
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
      const dateLabel = sorted.length > 1
        ? `${sorted.length} days (${format(new Date(sorted[0].date + 'T12:00:00'), 'MMM d')} – ${format(new Date(sorted[sorted.length - 1].date + 'T12:00:00'), 'MMM d, yyyy')})`
        : format(new Date(first.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
      const cancellable = first.status === 'confirmed' && first.confirmation_number && isStillCancellable(sorted.map(p => p.date))
      return {
        id: first.confirmation_number ?? first.id,
        sortKey: first.date,
        title: dateLabel,
        subtitle: `Day Pass · ${first.locations?.name ?? 'Unknown location'} · $${(totalCents / 100).toFixed(2)}${first.confirmation_number ? ` · #${first.confirmation_number}` : ''}`,
        status: first.status as UnifiedBooking['status'],
        cancellableConfirmationNumber: cancellable ? first.confirmation_number! : undefined,
        photo: LOCATION_PHOTOS[first.location_id],
      }
    }),
    ...(roomBookings ?? []).map(b => {
      const room = b.rooms as { name: string; external_name: string | null; locations: { name: string } | null } | null
      return {
        id: b.id,
        sortKey: b.start_time,
        title: format(new Date(b.start_time), 'EEEE, MMMM d, yyyy · h:mm a'),
        subtitle: `Room Booking · ${room?.external_name ?? room?.name ?? 'Room'} · ${room?.locations?.name ?? 'Unknown location'} · #${b.id.slice(0, 8).toUpperCase()}`,
        status: b.status as UnifiedBooking['status'],
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

      <div className="flex flex-col gap-3">
        {bookings.map(b => {
          const Icon = STATUS_ICON[b.status]
          return (
            <div key={b.id} className="border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {b.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.photo.src}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    style={b.photo.position ? { objectPosition: b.photo.position } : undefined}
                  />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">{b.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{b.subtitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {b.cancellableConfirmationNumber && (
                  <CancelDayPassButton confirmationNumber={b.cancellableConfirmationNumber} />
                )}
                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize', STATUS_STYLES[b.status])}>
                  <Icon size={13} /> {b.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
