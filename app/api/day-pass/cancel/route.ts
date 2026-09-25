import { format } from 'date-fns'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getPacificDayBounds } from '@/lib/utils'
import { voidSalesReceipt } from '@/lib/quickbooks'
import { sendDayPassCancellationStaffNotification, sendDayPassCancellationEmail, sendSystemAlert } from '@/lib/email'


// Self-serve cancellation for day passes only — never /book, conference
// rooms don't allow cancellations at all (Caroline, 2026-08-31).
//
// Takes a confirmation number, optionally narrowed to specific days via
// `dates` — a multi-day purchase can now be cancelled a day at a time
// (built 2026-09-16, after the all-or-nothing version left people emailing
// us to drop one day). Each day cancelled must still be before its 9am
// start (Caroline, 2026-09-18, was 12 hours before), and not already cancelled; the refund covers exactly
// the days being cancelled, and only their QuickBooks receipts are voided.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { confirmation_number, dates } = await request.json()
  if (!confirmation_number) return NextResponse.json({ error: 'Missing confirmation number.' }, { status: 400 })
  const onlyDates: string[] | null = Array.isArray(dates) && dates.length ? dates : null

  const admin = createAdminClient()

  // Ownership is checked explicitly here (customer_id === user.id), not
  // via RLS — day_passes has no UPDATE policy for customers at all, this
  // route has to use the service-role client to write the cancellation.
  const { data: allRows } = await admin
    .from('day_passes')
    .select('id, date, price_cents, status, stripe_payment_intent_id, qb_receipt_id, location_id, customer_id, locations(name)')
    .eq('confirmation_number', confirmation_number)
    .eq('customer_id', user.id)

  if (!allRows || allRows.length === 0) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  const rows = (onlyDates ? allRows.filter(r => onlyDates.includes(r.date)) : allRows)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Those days are not part of this booking.' }, { status: 404 })
  }

  if (rows.some(r => r.status !== 'confirmed')) {
    return NextResponse.json({ error: onlyDates ? 'That day has already been cancelled.' : 'This booking has already been cancelled or is no longer active.' }, { status: 400 })
  }

  // Cutoff is 9:00am Pacific on each day, the day pass's actual start
  // time, not midnight.
  const now = Date.now()
  const tooLate = rows.some(r => {
    const nineAm = getPacificDayBounds(r.date).start.getTime() + 9 * 3600000
    return now >= nineAm
  })
  if (tooLate) {
    return NextResponse.json({ error: rows.length === 1
      ? 'That day has already started, so it can no longer be cancelled. Questions? Contact us at hello@bizhaus.com.'
      : 'One of those days has already started, so it can no longer be cancelled. Cancel the others individually, or contact us at hello@bizhaus.com.' }, { status: 400 })
  }

  const totalCents = rows.reduce((sum, r) => sum + r.price_cents, 0)
  const paymentIntentId = rows[0].stripe_payment_intent_id
  const cancelledDates = [...rows].sort((a, b) => a.date.localeCompare(b.date)).map(r => r.date)
  const remainingDates = allRows
    .filter(r => r.status === 'confirmed' && !cancelledDates.includes(r.date))
    .map(r => r.date)
    .sort()

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
    .in('id', rows.map(r => r.id))

  if (updateError) {
    // The refund already went through — this is now a state mismatch that
    // needs a human, not something to fail silently or retry blindly.
    console.error('[day-pass/cancel] Refund succeeded but status update failed:', updateError.message)
    await sendSystemAlert('Day pass refund succeeded but status update failed', {
      confirmation_number, customer_id: user.id, error: updateError.message,
    })
    return NextResponse.json({ error: 'Refund processed, but something went wrong updating your booking. Contact us at hello@bizhaus.com to confirm.' }, { status: 500 })
  }

  // Void the QuickBooks receipt for each day — best-effort, one location
  // per group so failures here don't affect the customer at all (refund
  // already succeeded). Same silent-failure class as the receipt-creation
  // bug found 2026-09-02 — without an alert, QB would keep showing revenue
  // for a day that was actually refunded, with no one aware of the drift.
  for (const r of rows) {
    if (!r.qb_receipt_id) continue
    try {
      await voidSalesReceipt(r.location_id, r.qb_receipt_id)
    } catch (err) {
      console.error('[day-pass/cancel] Failed to void QB receipt:', r.qb_receipt_id, err)
      await sendSystemAlert('Day pass QB receipt void failed', {
        confirmation_number, day_pass_id: r.id, qb_receipt_id: r.qb_receipt_id,
        error: err instanceof Error ? err.message : String(err),
      })
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

    const pretty = (d: string) => format(new Date(d + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
    const dateLabel = cancelledDates.length > 1
      ? `${cancelledDates.length} days: ${cancelledDates.map(pretty).join(', ')}`
      : pretty(cancelledDates[0])

    if (customer) {
      await sendDayPassCancellationEmail(customer.email, {
        guestName: `${customer.first_name} ${customer.last_name}`,
        location: (rows[0].locations as unknown as { name: string } | null)?.name ?? 'Unknown location',
        dates: cancelledDates.map(pretty),
        remainingDates: remainingDates.map(pretty),
        refundAmount: `$${(totalCents / 100).toFixed(2)}`,
        confirmationNumber: confirmation_number,
      })
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

  return NextResponse.json({ ok: true, refundedCents: totalCents, cancelledDates, remainingDates })
}
