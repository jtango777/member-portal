import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { getPacificDayBounds } from '@/lib/utils'
import { voidSalesReceipt } from '@/lib/quickbooks'
import { sendDayPassCancellationStaffNotification } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

// Self-serve cancellation for day passes only — never /book, conference
// rooms don't allow cancellations at all (Caroline, 2026-08-31). Cancels
// a whole confirmation_number group at once (a multi-day purchase is
// all-or-nothing here, not per-day) — every day in the group must still
// be more than 12 hours out, and none already cancelled/declined.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { confirmation_number } = await request.json()
  if (!confirmation_number) return NextResponse.json({ error: 'Missing confirmation number.' }, { status: 400 })

  const admin = createAdminClient()

  // Ownership is checked explicitly here (customer_id === user.id), not
  // via RLS — day_passes has no UPDATE policy for customers at all, this
  // route has to use the service-role client to write the cancellation.
  const { data: rows } = await admin
    .from('day_passes')
    .select('id, date, price_cents, status, stripe_payment_intent_id, qb_receipt_id, location_id, customer_id, locations(name)')
    .eq('confirmation_number', confirmation_number)
    .eq('customer_id', user.id)

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  if (rows.some(r => r.status !== 'confirmed')) {
    return NextResponse.json({ error: 'This booking has already been cancelled or is no longer active.' }, { status: 400 })
  }

  // 12-hour cutoff, measured from 9:00am Pacific on each day — the day
  // pass's actual start time, not midnight.
  const now = Date.now()
  const tooLate = rows.some(r => {
    const nineAm = getPacificDayBounds(r.date).start.getTime() + 9 * 3600000
    const cutoff = nineAm - 12 * 3600000
    return now >= cutoff
  })
  if (tooLate) {
    return NextResponse.json({ error: 'Some days in this booking are less than 12 hours away — contact us at hello@bizhaus.com to cancel.' }, { status: 400 })
  }

  const totalCents = rows.reduce((sum, r) => sum + r.price_cents, 0)
  const paymentIntentId = rows[0].stripe_payment_intent_id

  if (paymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId, amount: totalCents })
    } catch (err) {
      console.error('[day-pass/cancel] Stripe refund failed:', err)
      return NextResponse.json({ error: 'Could not process refund. Please contact us at hello@bizhaus.com.' }, { status: 500 })
    }
  }

  const { error: updateError } = await admin
    .from('day_passes')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('confirmation_number', confirmation_number)
    .eq('customer_id', user.id)

  if (updateError) {
    // The refund already went through — this is now a state mismatch that
    // needs a human, not something to fail silently or retry blindly.
    console.error('[day-pass/cancel] Refund succeeded but status update failed:', updateError.message)
    return NextResponse.json({ error: 'Refund processed, but something went wrong updating your booking. Contact us at hello@bizhaus.com to confirm.' }, { status: 500 })
  }

  // Void the QuickBooks receipt for each day — best-effort, one location
  // per group so failures here don't affect the customer at all (refund
  // already succeeded).
  for (const r of rows) {
    if (!r.qb_receipt_id) continue
    try {
      await voidSalesReceipt(r.location_id, r.qb_receipt_id)
    } catch (err) {
      console.error('[day-pass/cancel] Failed to void QB receipt:', r.qb_receipt_id, err)
    }
  }

  // Staff notification — same non-blocking pattern as every other email
  // in this app.
  try {
    const { data: customer } = await admin
      .from('booking_customers')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single()

    const dateLabel = rows.length > 1
      ? `${rows.length} days, starting ${rows[0].date}`
      : rows[0].date

    if (customer) {
      await sendDayPassCancellationStaffNotification({
        confirmationNumber: confirmation_number,
        guestName: `${customer.first_name} ${customer.last_name}`,
        guestEmail: customer.email,
        location: (rows[0].locations as unknown as { name: string } | null)?.name ?? 'Unknown location',
        date: dateLabel,
        refundAmount: `$${(totalCents / 100).toFixed(2)}`,
      })
    }
  } catch (err) {
    console.error('[day-pass/cancel] Failed to send staff notification:', err)
  }

  return NextResponse.json({ ok: true, refundedCents: totalCents })
}
