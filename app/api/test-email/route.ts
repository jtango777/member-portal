import { NextResponse } from 'next/server'
import { sendExternalBookingReceipt } from '@/lib/email'
import Stripe from 'stripe'
import { format } from 'date-fns'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const piId = searchParams.get('pi')

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
      } else {
        steps.push('no latest_charge on PI')
      }
    } else {
      steps.push('no PI id provided, skipping stripe')
    }

    steps.push('sending email...')
    await sendExternalBookingReceipt('caroline@bizhaus.com', {
      confirmationNumber: 'TEST1234',
      room: 'Test Room',
      location: 'El Segundo',
      date: format(new Date(), 'EEEE, MMMM d, yyyy'),
      time: '9:00 AM – 10:00 AM',
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
