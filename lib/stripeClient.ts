import { loadStripe, type Stripe } from '@stripe/stripe-js'

// The browser half of the per-entity Stripe split (2026-10-06).
//
// The card form has to be created with the publishable key belonging to the
// same account that created the payment, or Stripe rejects the client secret
// as not its own. So the key is chosen by location, exactly as the server
// chooses the secret key.
//
// Written out one by one deliberately. NEXT_PUBLIC_* values are substituted
// into the bundle at build time by matching the literal text, so a computed
// name like process.env[`NEXT_PUBLIC_..._${suffix}`] is not replaced and
// reads as undefined in the browser. This has to stay a plain lookup table.

const PUBLISHABLE_KEYS: Record<string, string | undefined> = {
  // El Segundo keeps the original unsuffixed key.
  '11111111-1111-1111-1111-111111111101': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  '11111111-1111-1111-1111-111111111102': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_MARINA,
  '11111111-1111-1111-1111-111111111103': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_COSTA_MESA,
}

/** Loaded once per location, not once per render. */
const loaded = new Map<string, Promise<Stripe | null>>()

export function stripePromiseFor(locationId: string): Promise<Stripe | null> {
  const existing = loaded.get(locationId)
  if (existing) return existing

  const key = PUBLISHABLE_KEYS[locationId]
  if (!key) {
    console.error(`[stripe] No publishable key for location ${locationId}`)
    return Promise.resolve(null)
  }

  const promise = loadStripe(key)
  loaded.set(locationId, promise)
  return promise
}
