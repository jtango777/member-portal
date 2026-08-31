import { createAdminClient } from '@/lib/supabase/server'
import BookingAccountsManager from '@/components/admin/BookingAccountsManager'

export const dynamic = 'force-dynamic'

// booking_customers is the shared account system behind /day-pass and
// /book (see migrations 044/045/046) — one login per person covers both
// products. Until now staff could only see a customer's info indirectly,
// buried inside the Day Passes or External Bookings lists; this page is
// the first place to see an account itself, its full history across
// both products, and whether it ever converted at all.
//
// RLS on booking_customers/day_passes/external_bookings only lets a
// customer read their own rows — this page is gated to admins at the
// layout level, so it uses the service-role client to see everyone's,
// same convention as the rest of the admin dashboard.
export default async function BookingAccountsPage() {
  const supabase = createAdminClient()

  const [{ data: customers }, { data: dayPasses }, { data: roomBookings }] = await Promise.all([
    supabase
      .from('booking_customers')
      .select('id, first_name, last_name, email, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('day_passes')
      .select('customer_id, date, price_cents, status, confirmation_number, locations(name)'),
    supabase
      .from('external_bookings')
      .select('customer_id, start_time, end_time, status, rooms(name, external_name, price_per_hour, locations(name))')
      .not('customer_id', 'is', null),
  ])

  return (
    <BookingAccountsManager
      customers={customers ?? []}
      dayPasses={(dayPasses ?? []) as any}
      roomBookings={(roomBookings ?? []) as any}
    />
  )
}
