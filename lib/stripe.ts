import Stripe from 'stripe'

// One Stripe client, created the first time something actually uses it.
//
// Every route used to do `new Stripe(process.env.STRIPE_SECRET_KEY!)` at the
// top of the file, which runs while Next builds the page. A build with no
// Stripe key then died with "Neither apiKey nor config.authenticator
// provided" — which is what broke preview builds the moment the live keys
// were scoped to production only (2026-09-25). A missing key should fail the
// one request that needs it, with a message that says so, not the build.
let client: Stripe | null = null

function real(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set in this environment')
    client = new Stripe(key)
  }
  return client
}

/** Use exactly like a Stripe instance: `stripe.paymentIntents.create(...)`. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const value = (real() as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(real()) : value
  },
})

/**
 * What Stripe actually kept from a payment, in dollars.
 *
 * Read from the balance transaction rather than calculated, because the rate
 * is not uniform: a $39 day pass netted $37.57 on one card and $36.98 on
 * another, the second being an international card at a higher rate. Working
 * the fee out from a hardcoded 2.9% + 30c would quietly be wrong on those
 * (2026-10-05).
 *
 * Returns 0 when the fee isn't available yet rather than throwing, since the
 * caller is in the middle of a booking the customer has already paid for.
 */
export async function stripeFeeDollars(paymentIntentId: string): Promise<number> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    })
    const charge = pi.latest_charge
    if (!charge || typeof charge === 'string') return 0
    const txn = charge.balance_transaction
    if (!txn || typeof txn === 'string') return 0
    return txn.fee / 100
  } catch (err) {
    console.error('[stripe] Could not read fee for', paymentIntentId, err instanceof Error ? err.message : err)
    return 0
  }
}
