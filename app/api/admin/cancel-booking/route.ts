import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { stripe } from '@/lib/stripe'
import { voidSalesReceipt } from '@/lib/quickbooks'
import { sendDayPassCancellationEmail, sendRoomBookingCancellationEmail, sendSystemAlert } from '@/lib/email'

// Staff override for cancellations (Caroline, 2026-09-28).
//
// Customers can only cancel a day pass themselves before its 9am start, and
// conference rooms are sold as non-refundable. Neither rule binds staff: if
// someone rings up, BizHaus can cancel it whatever the clock says, and
// decide whether the money goes back on the card or stays with us as credit
// toward a future booking. That second option is the usual answer for rooms
// and is deliberately not advertised anywhere customer-facing.
//
// Refund or not, the booking is released: the day or the room goes back on
// sale, and the QuickBooks receipt is voided when the money is returned.

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  // `refund` defaults to false on purpose: a request that forgets to say
  // should never move money.
  const { type, id, confirmation_number, dates, refund = false, notify = true } = await request.json()
  const admin = createAdminClient()

  // ── Day passes ──────────────────────────────────────────────────────────
  if (type === 'day_pass') {
    if (!confirmation_number) return NextResponse.json({ error: 'Missing confirmation number.' }, { status: 400 })

    const { data: allRows } = await admin
      .from('day_passes')
      .select('id, date, price_cents, status, stripe_payment_intent_id, qb_receipt_id, location_id, customer_id, locations(name)')
      .eq('confirmation_number', confirmation_number)

    if (!allRows?.length) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

    const wanted = Array.isArray(dates) && dates.length ? allRows.filter(r => dates.includes(r.date)) : allRows
    const rows = wanted.filter(r => r.status === 'confirmed')
    if (!rows.length) return NextResponse.json({ error: 'Those days are already cancelled.' }, { status: 400 })

    const totalCents = rows.reduce((sum, r) => sum + r.price_cents, 0)
    const cancelledDates = [...rows].sort((a, b) => a.date.localeCompare(b.date)).map(r => r.date)
    const remainingDates = allRows
      .filter(r => r.status === 'confirmed' && !cancelledDates.includes(r.date))
      .map(r => r.date).sort()

    if (refund && rows[0].stripe_payment_intent_id) {
      try {
        await stripe.refunds.create({ payment_intent: rows[0].stripe_payment_intent_id, amount: totalCents })
      } catch (err) {
        console.error('[admin/cancel-booking] Refund failed:', err)
        return NextResponse.json({ error: 'The refund failed in Stripe, so nothing was cancelled. Check the payment in Stripe and try again.' }, { status: 500 })
      }
    }

    const { error: updateError } = await admin
      .from('day_passes')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .in('id', rows.map(r => r.id))

    if (updateError) {
      console.error('[admin/cancel-booking] Status update failed after refund:', updateError.message)
      await sendSystemAlert('Admin cancellation: refund succeeded but status update failed', {
        confirmation_number, refunded: refund, error: updateError.message,
      })
      return NextResponse.json({ error: 'The refund went through but the booking did not update. Do not retry; check Stripe and tell Caroline.' }, { status: 500 })
    }

    // Only void the receipt when the money actually went back. A credit
    // toward a future booking is still revenue, so the books stay as they are.
    if (refund) {
      for (const r of rows) {
        if (!r.qb_receipt_id) continue
        try {
          await voidSalesReceipt(r.location_id, r.qb_receipt_id)
        } catch (err) {
          console.error('[admin/cancel-booking] QB void failed:', r.qb_receipt_id, err)
          await sendSystemAlert('Admin cancellation: QuickBooks receipt void failed', {
            confirmation_number, qb_receipt_id: r.qb_receipt_id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    if (notify) {
      try {
        const { data: customer } = await admin
          .from('booking_customers').select('first_name, last_name, email').eq('id', rows[0].customer_id).single()
        const pretty = (d: string) => format(new Date(d + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
        if (customer) {
          await sendDayPassCancellationEmail(customer.email, {
            guestName: `${customer.first_name} ${customer.last_name}`,
            location: (rows[0].locations as unknown as { name: string } | null)?.name ?? '',
            dates: cancelledDates.map(pretty),
            remainingDates: remainingDates.map(pretty),
            refundAmount: `$${(totalCents / 100).toFixed(2)}`,
            confirmationNumber: confirmation_number,
            credited: !refund,
          })
        }
      } catch (err) {
        console.error('[admin/cancel-booking] Customer email failed:', err)
      }
    }

    return NextResponse.json({ ok: true, cancelledDays: rows.length, amount: totalCents / 100, refunded: refund })
  }

  // ── Conference room bookings ────────────────────────────────────────────
  if (type === 'room') {
    if (!id) return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 })

    const { data: booking } = await admin
      .from('external_bookings')
      .select('id, reservation_id, status, stripe_payment_intent_id, qb_receipt_id, external_name, external_email, start_time, room_id, rooms(location_id, name, external_name, locations(name))')
      .eq('id', id)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    if (booking.status === 'cancelled') return NextResponse.json({ error: 'That booking is already cancelled.' }, { status: 400 })

    // Read the amount even when we're not refunding — the credit email has
    // to name a figure, and Stripe is the only place the real charge lives.
    let amountCents = 0
    if (booking.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        amountCents = pi.amount
        if (refund) await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id })
      } catch (err) {
        console.error('[admin/cancel-booking] Room refund failed:', err)
        return NextResponse.json({ error: 'The refund failed in Stripe, so nothing was cancelled. Check the payment in Stripe and try again.' }, { status: 500 })
      }
    }

    await admin.from('external_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', booking.id)
    // Free the slot so the room can be booked again.
    if (booking.reservation_id) await admin.from('reservations').delete().eq('id', booking.reservation_id)

    if (refund && booking.qb_receipt_id) {
      const locationId = (booking.rooms as unknown as { location_id: string } | null)?.location_id
      try {
        if (locationId) await voidSalesReceipt(locationId, booking.qb_receipt_id)
      } catch (err) {
        console.error('[admin/cancel-booking] Room QB void failed:', err)
        await sendSystemAlert('Admin cancellation: QuickBooks receipt void failed', {
          booking_id: booking.id, qb_receipt_id: booking.qb_receipt_id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (notify && booking.external_email) {
      try {
        const room = booking.rooms as unknown as { location_id: string; name?: string; external_name?: string; locations?: { name: string } } | null
        const start = new Date(booking.start_time)
        await sendRoomBookingCancellationEmail(booking.external_email, {
          guestName: booking.external_name ?? '',
          room: room?.external_name ?? room?.name ?? 'your room',
          location: room?.locations?.name ?? '',
          when: format(start, "EEEE, MMMM d 'at' h:mma"),
          amount: `$${(amountCents / 100).toFixed(2)}`,
          credited: !refund,
        })
      } catch (err) {
        console.error('[admin/cancel-booking] Room email failed:', err)
      }
    }

    return NextResponse.json({ ok: true, amount: amountCents / 100, refunded: refund })
  }

  return NextResponse.json({ error: 'Unknown booking type.' }, { status: 400 })
}
