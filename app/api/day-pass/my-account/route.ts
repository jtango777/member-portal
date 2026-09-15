import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  return NextResponse.json({ customer })
}

export const GET  = () => handle(false)
export const POST = () => handle(true)
