import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrLinkBookingCustomer } from '@/lib/bookingAccounts'

// The signed-in visitor's booking account, shared by day-pass and /book.
// GET only looks (a staff/member login gets their would-be details back
// without being added to Booking Accounts); POST creates the link for real
// — called on login and right before checkout. See getOrLinkBookingCustomer.
async function handle(create: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ customer: null })
  const customer = await getOrLinkBookingCustomer(user.id, create)
  if (create && !customer) return NextResponse.json({ error: 'Could not set up your booking account.' }, { status: 500 })

  // Days they already hold, so the calendar can show them as taken rather
  // than letting someone pick a day they'd only be refused at checkout
  // (Caroline, 2026-09-16).
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const { data: booked } = await createAdminClient()
    .from('day_passes')
    .select('date')
    .eq('customer_id', user.id)
    .eq('status', 'confirmed')
    .gte('date', today)
  return NextResponse.json({ customer, bookedDates: (booked ?? []).map(r => r.date) })
}

export const GET  = () => handle(false)
export const POST = () => handle(true)
