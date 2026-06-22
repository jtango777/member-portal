import { NextResponse } from 'next/server'
import { sendExternalBookingReceipt } from '@/lib/email'
import Stripe from 'stripe'
import { format } from 'date-fns'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const piId = searchParams.get('pi')
  const date = searchParams.get('date') ?? '2026-10-01'
  const start = searchParams.get('start') ?? '09:00'
  const end = searchParams.get('end') ?? '10:00'

  const steps: string[] = []

  try {
    steps.push('started')

    let cardLast4: string | null = null
    let cardBrand: string | null = null
    let amountPaid = '$0.00'

    if (piId) {
      steps.push('retrieving payment intent: ' + piId)
      const pi = await stripe.paymentIntents.retrieve(piId)
      amountPaid = `$${(pi.amount / 100).toFixed(2)}`
      steps.push('amount: ' + amountPaid)

      if (pi.latest_charge) {
        steps.push('retrieving charge: ' + pi.latest_charge)
        const charge = await stripe.charges.retrieve(pi.latest_charge as string)
        cardLast4 = charge.payment_method_details?.card?.last4 ?? null
        cardBrand = charge.payment_method_details?.card?.brand ?? null
        steps.push('card: ' + cardBrand + ' ' + cardLast4)
      }
    }

    // Use the same date parsing as the real booking route
    const padTime = (t: string) => t.includes(':') && t.indexOf(':') < 2 ? '0' + t : t
    steps.push(`parsing dates — date: "${date}", start: "${start}" -> "${padTime(start)}", end: "${end}" -> "${padTime(end)}"`)
    const dateObj = new Date(date + 'T12:00:00')
    const startObj = new Date(`2000-01-01T${padTime(start)}:00`)
    const endObj = new Date(`2000-01-01T${padTime(end)}:00`)
    steps.push(`parsed — dateObj: ${dateObj}, startObj: ${startObj}, endObj: ${endObj}`)

    const formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy')
    const startLabel = format(startObj, 'h:mm a')
    const endLabel = format(endObj, 'h:mm a')
    steps.push(`formatted — ${formattedDate}, ${startLabel} – ${endLabel}`)

    steps.push('sending email...')
    await sendExternalBookingReceipt('caroline@bizhaus.com', {
      confirmationNumber: 'TEST1234',
      room: 'Test Room',
      location: 'El Segundo',
      date: formattedDate,
      time: `${startLabel} – ${endLabel}`,
      guestName: 'Test Guest',
      amountPaid,
      cardLast4,
      cardBrand,
      paymentDate: format(new Date(), 'MMMM d, yyyy'),
    })
    steps.push('email sent!')

    return NextResponse.json({ ok: true, steps })
  } catch (err: unknown) {
    steps.push('ERROR: ' + String(err))
    return NextResponse.json({ ok: false, steps, error: String(err) })
  }
}
