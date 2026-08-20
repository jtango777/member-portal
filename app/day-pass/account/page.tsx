import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import SignOutButton from '@/components/day-pass/SignOutButton'

export const dynamic = 'force-dynamic'

const STATUS_ICON = { confirmed: CheckCircle, pending: Clock, declined: XCircle } as const
const STATUS_STYLES = {
  confirmed: 'text-green-600 bg-green-50',
  pending: 'text-amber-600 bg-amber-50',
  declined: 'text-red-600 bg-red-50',
} as const

type UnifiedBooking = {
  id: string
  sortKey: string
  title: string
  subtitle: string
  status: 'confirmed' | 'pending' | 'declined'
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

  // Day passes and /book room bookings are different shapes — same shared
  // account, so unify them into one list here rather than showing two
  // disconnected sections.
  const bookings: UnifiedBooking[] = [
    ...(dayPasses ?? []).map(pass => ({
      id: pass.id,
      sortKey: pass.date,
      title: format(new Date(pass.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy'),
      subtitle: `Day Pass · ${pass.locations?.name ?? 'Unknown location'} · $${(pass.price_cents / 100).toFixed(2)}${pass.confirmation_number ? ` · #${pass.confirmation_number}` : ''}`,
      status: pass.status as UnifiedBooking['status'],
    })),
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
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey))

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
              <div>
                <div className="font-semibold text-gray-900">{b.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">{b.subtitle}</div>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0', STATUS_STYLES[b.status])}>
                <Icon size={13} /> {b.status}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
