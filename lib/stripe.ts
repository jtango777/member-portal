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
