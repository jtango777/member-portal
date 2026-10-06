import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripeFor, webhookSecrets } from '@/lib/stripe'
import { getQbBankAccounts } from '@/lib/settings'
import { createAdminClient } from '@/lib/supabase/server'
import { createSalesReceipt, recordPayoutDeposit } from '@/lib/quickbooks'
import { sendSystemAlert } from '@/lib/email'

/**
 * All three accounts' webhooks point at this one URL, so the signature is
 * what identifies the sender: an event is from whichever account's secret
 * verifies it. Trying each is cheap, and it means adding a fourth entity
 * later needs no change here (2026-10-06).
 */
function verify(body: string, sig: string): { event: Stripe.Event; locationId: string } | null {
  for (const { locationId, secret } of webhookSecrets()) {
    try {
      const anyClient = stripeFor(locationId)
      return { event: anyClient.webhooks.constructEvent(body, sig, secret), locationId }
    } catch {
      // Not this account's secret, or its key is not configured here.
    }
  }
  return null
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const verified = verify(body, sig)
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  const { event } = verified

  const admin = createAdminClient()
  console.log('[webhook] Event received:', event.type)

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: booking } = await admin
      .from('external_bookings')
      .select('id, status, room_id, external_name, external_email, external_phone, start_time, end_time, qb_receipt_id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (booking && booking.status !== 'confirmed') {
      await admin
        .from('external_bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking.id)
    }

    // /api/book/request now creates the QuickBooks sales receipt itself
    // (same reasoning as day passes above — this webhook can fire before
    // that route's own inserts have landed). This is just a backup for the
    // rare case that route's own receipt creation didn't run, guarded to
    // skip if a receipt already exists so nothing double-creates.
    if (booking && !booking.qb_receipt_id) {
      try {
        const { data: room } = await admin
          .from('rooms')
          .select('name, external_name, price_per_hour, location_id, locations(qb_room_item)')
          .eq('id', booking.room_id)
          .single()

        if (room) {
          const totalAmount = pi.amount_received / 100

          const startDt = new Date(booking.start_time)
          const endDt = new Date(booking.end_time)
          // Format times in Pacific (BizHaus locations are all in CA)
          const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }
          const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }
          const startLabel = startDt.toLocaleTimeString('en-US', timeOpts)
          const endLabel = endDt.toLocaleTimeString('en-US', timeOpts)
          const dateLabel = startDt.toLocaleDateString('en-US', dateOpts)

          console.log('[qb] Creating sales receipt — location:', room.location_id, 'amount:', totalAmount)

          const receipt = await createSalesReceipt(room.location_id, {
            guestName: booking.external_name,
            email: booking.external_email,
            phone: booking.external_phone,
            roomName: room.external_name ?? room.name,
            date: dateLabel,
            time: `${startLabel} – ${endLabel}`,
            amount: totalAmount,
            // Same product the booking route would have used, so the two
            // paths can't book the same sale to different revenue lines.
            itemName: (room as any).locations?.qb_room_item ?? 'Event / Conference Rm Fee',
            description: `${room.external_name ?? room.name} — ${dateLabel}, ${startLabel} – ${endLabel}`,
          })
          if (receipt?.Id) {
            await admin.from('external_bookings').update({ qb_receipt_id: receipt.Id }).eq('id', booking.id)
          }
          console.log('[qb] Sales receipt created successfully')
        }
      } catch (err: any) {
        if (err?.message === 'QB_NEEDS_RECONNECT') {
          console.warn('[qb] Location needs reconnection — skipping sales receipt')
          await sendSystemAlert('QuickBooks needs reconnecting', { booking_id: booking.id })
        } else {
          console.error('[qb] Failed to create sales receipt:', err)
          // This is the backup path — /api/book/request already tried and
          // presumably also failed (or never ran), so this booking genuinely
          // has no receipt with nothing left to retry it automatically.
          await sendSystemAlert('Room booking QB receipt creation failed (backup path also failed)', {
            booking_id: booking.id, error: err?.message ?? String(err),
          })
        }
      }
    }

    // Day passes are inserted already-confirmed by /api/day-pass/request
    // (it re-verifies payment before writing the row), so there's no status
    // flip to do here. /api/day-pass/request also creates the QuickBooks
    // sales receipt itself now (see comment there) since this webhook can
    // fire before that insert has landed — this block is just a backup for
    // the rare case that route's own receipt creation didn't run (e.g. it
    // errored after the insert but before reaching that code). Guarded to
    // skip any row that already has a receipt, so nothing double-creates.
    const { data: dayPasses } = await admin
      .from('day_passes')
      .select('id, customer_id, location_id, date, price_cents, qb_receipt_id')
      .eq('stripe_payment_intent_id', pi.id)
      .is('qb_receipt_id', null)

    if (dayPasses && dayPasses.length > 0) {
      const { data: customer } = await admin
        .from('booking_customers')
        .select('first_name, last_name, email')
        .eq('id', dayPasses[0].customer_id)
        .single()

      if (customer) {
        const { data: dpLocations } = await admin
          .from('locations')
          .select('id, qb_day_pass_item')
        const dayPassItemFor = (locationId: string) =>
          (dpLocations as { id: string; qb_day_pass_item: string }[] | null)
            ?.find(l => l.id === locationId)?.qb_day_pass_item ?? 'Day Pass'

        // One QuickBooks line item per day, same per-instance pattern the
        // rest of this webhook uses — a range just means more calls here.
        for (const dayPass of dayPasses) {
          try {
            const dateLabel = new Date(dayPass.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
            })
            const amount = dayPass.price_cents / 100

            console.log('[qb] Creating day pass sales receipt — location:', dayPass.location_id, 'date:', dayPass.date, 'amount:', amount)

            const receipt = await createSalesReceipt(dayPass.location_id, {
              guestName: `${customer.first_name} ${customer.last_name}`,
              email: customer.email,
              phone: '',
              roomName: 'Day Pass',
              date: dateLabel,
              time: '9:00am – 5:00pm',
              amount,
              itemName: dayPassItemFor(dayPass.location_id),
              description: `Day Pass — ${dateLabel}`,
            })
            // Stored so a later self-serve cancellation can void this exact
            // receipt instead of having to search QB for it.
            if (receipt?.Id) {
              await admin.from('day_passes').update({ qb_receipt_id: receipt.Id }).eq('id', dayPass.id)
            }
            console.log('[qb] Day pass sales receipt created successfully')
          } catch (err: any) {
            if (err?.message === 'QB_NEEDS_RECONNECT') {
              console.warn('[qb] Location needs reconnection — skipping day pass sales receipt')
              await sendSystemAlert('QuickBooks needs reconnecting', { day_pass_id: dayPass.id })
              break // same location for every row in the group — no point retrying each one
            } else {
              console.error('[qb] Failed to create day pass sales receipt:', err)
              // This is the backup path — /api/day-pass/request already
              // tried and presumably also failed (or never ran), so this
              // day pass genuinely has no receipt with nothing left to
              // retry it automatically.
              await sendSystemAlert('Day pass QB receipt creation failed (backup path also failed)', {
                day_pass_id: dayPass.id, error: err?.message ?? String(err),
              })
            }
          }
        }
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: booking } = await admin
      .from('external_bookings')
      .select('id, reservation_id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (booking) {
      await admin
        .from('external_bookings')
        .update({ status: 'declined' })
        .eq('id', booking.id)

      if (booking.reservation_id) {
        await admin
          .from('reservations')
          .delete()
          .eq('id', booking.reservation_id)
      }
    }

    // A multi-day purchase shares one payment intent across several rows —
    // decline all of them, not just one.
    await admin.from('day_passes').update({ status: 'declined' }).eq('stripe_payment_intent_id', pi.id)
  }

  // Stripe has sent money to the bank. Record it as a deposit so the books
  // show the money arriving and what Stripe kept, instead of every sale
  // sitting in Undeposited Funds for someone to clear by hand.
  //
  // Both events are handled: reconciliation_completed is the one that
  // guarantees the payout's contents can be listed, and paid is the fallback
  // for accounts that never send it. recordPayoutDeposit is idempotent on
  // the payout id, so whichever arrives first wins.
  if (event.type === 'payout.paid' || event.type === 'payout.reconciliation_completed') {
    const payout = event.data.object as Stripe.Payout
    await recordPayout(verified.locationId, payout)
  }

  return NextResponse.json({ received: true })
}

/**
 * Turns one Stripe payout into one QuickBooks deposit.
 *
 * The join runs: payout → its balance transactions → the charges in it →
 * their payment intents → our own rows → the sales receipts already in
 * QuickBooks. Anything that cannot be matched is left out rather than
 * guessed at, and the deposit is skipped entirely if nothing matches, so a
 * payout covering a refund or a transfer does not create an empty entry.
 */
async function recordPayout(locationId: string, payout: Stripe.Payout) {
  const bankAccounts = await getQbBankAccounts()
  const bankAccountName = bankAccounts[locationId]
  if (!bankAccountName) {
    console.warn(
      `[webhook] Payout ${payout.id}: no QuickBooks bank account set for location ` +
      `${locationId}. Set one in Admin → QuickBooks and future payouts will record.`
    )
    return
  }

  const stripe = stripeFor(locationId)
  const admin = createAdminClient()

  // Every balance transaction in this payout, following Stripe's pages.
  const txns: Stripe.BalanceTransaction[] = []
  for await (const t of stripe.balanceTransactions.list({ payout: payout.id, limit: 100, expand: ['data.source'] })) {
    txns.push(t)
  }

  let feeTotal = 0
  const paymentIntentIds: string[] = []
  for (const t of txns) {
    feeTotal += t.fee
    if (t.type !== 'charge' && t.type !== 'payment') continue
    const source = t.source as Stripe.Charge | string | null
    const pi = source && typeof source !== 'string' ? source.payment_intent : null
    if (typeof pi === 'string') paymentIntentIds.push(pi)
  }

  if (paymentIntentIds.length === 0) {
    console.log(`[webhook] Payout ${payout.id} contained no charges, nothing to deposit.`)
    return
  }

  // Our own records hold the QuickBooks receipt id for each sale.
  const [{ data: passes }, { data: rooms }] = await Promise.all([
    admin.from('day_passes')
      .select('qb_receipt_id, price_cents')
      .in('stripe_payment_intent_id', paymentIntentIds)
      .eq('status', 'confirmed'),
    admin.from('external_bookings')
      .select('qb_receipt_id, stripe_payment_intent_id')
      .in('stripe_payment_intent_id', paymentIntentIds),
  ])

  const receipts: { id: string; amount: number }[] = []
  for (const p of passes ?? []) {
    if (p.qb_receipt_id) receipts.push({ id: p.qb_receipt_id, amount: p.price_cents / 100 })
  }
  // Room bookings keep no amount of their own; take it from the charge.
  const roomAmounts = new Map<string, number>()
  for (const t of txns) {
    const source = t.source as Stripe.Charge | string | null
    const pi = source && typeof source !== 'string' ? source.payment_intent : null
    if (typeof pi === 'string') roomAmounts.set(pi, t.amount / 100)
  }
  for (const b of rooms ?? []) {
    if (b.qb_receipt_id) {
      receipts.push({ id: b.qb_receipt_id, amount: roomAmounts.get(b.stripe_payment_intent_id) ?? 0 })
    }
  }

  if (receipts.length === 0) {
    console.warn(`[webhook] Payout ${payout.id}: no QuickBooks receipts found for its charges.`)
    return
  }

  const result = await recordPayoutDeposit(locationId, {
    payoutId: payout.id,
    date: new Date(payout.arrival_date * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    receipts,
    feeTotal: feeTotal / 100,
    bankAccountName,
  })

  if (result) {
    console.log(`[webhook] Payout ${payout.id} recorded as deposit ${result.Id}.`)
  } else {
    await sendSystemAlert('Stripe payout could not be recorded in QuickBooks', {
      payout: payout.id, location_id: locationId, receipts: receipts.length,
    })
  }
}
