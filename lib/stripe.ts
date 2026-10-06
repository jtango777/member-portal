import Stripe from 'stripe'

// One Stripe account per BizHaus entity (2026-10-06).
//
// The three locations are three separate legal entities with their own EINs
// and their own bank accounts, but every payment used to go through one
// Stripe account registered to BizHaus 1730 Holly, LP. That meant Marina's
// and Costa Mesa's revenue was legally received by the El Segundo entity,
// and a single payout mixed all three companies' money, so nobody could
// reconcile a deposit against any one set of books.
//
// Clients are created the first time something actually uses one. Every
// route used to do `new Stripe(process.env.STRIPE_SECRET_KEY!)` at the top
// of the file, which runs while Next builds the page, and a build with no
// Stripe key died with "Neither apiKey nor config.authenticator provided"
// — which is what broke preview builds the moment the live keys were scoped
// to production only (2026-09-25). A missing key should fail the one
// request that needs it, with a message that says so, not the build.

/**
 * Which set of environment variables belongs to which location.
 *
 * El Segundo deliberately has no suffix: its keys are the original ones,
 * already in production and working, and re-pasting a live secret key to
 * rename it is risk with no benefit.
 */
const ENV_SUFFIX: Record<string, string> = {
  '11111111-1111-1111-1111-111111111101': '',             // El Segundo
  '11111111-1111-1111-1111-111111111102': '_MARINA',      // Marina del Rey
  '11111111-1111-1111-1111-111111111103': '_COSTA_MESA',  // Costa Mesa
}

/** The account every payment taken before 2026-10-06 lives on. */
export const LEGACY_LOCATION_ID = '11111111-1111-1111-1111-111111111101'

const clients = new Map<string, Stripe>()

function clientForSuffix(suffix: string): Stripe {
  const existing = clients.get(suffix)
  if (existing) return existing

  const name = `STRIPE_SECRET_KEY${suffix}`
  const key = process.env[name]
  if (!key) throw new Error(`${name} is not set in this environment`)

  const created = new Stripe(key)
  clients.set(suffix, created)
  return created
}

/**
 * The Stripe account that location's money belongs in. Use this for anything
 * that takes money, so each entity's revenue lands in its own account and
 * its own bank.
 */
export function stripeFor(locationId: string): Stripe {
  const suffix = ENV_SUFFIX[locationId]
  if (suffix === undefined) {
    throw new Error(`No Stripe account configured for location ${locationId}`)
  }
  return clientForSuffix(suffix)
}

/**
 * The Stripe account a *specific existing payment* lives on.
 *
 * Every payment taken before the split is on the El Segundo account, whatever
 * location it was for. Refunding against the location's own account would
 * fail on those with "No such payment_intent", which would look like a
 * broken refund button rather than a payment on another account. So: try the
 * location's account, and fall back to the original one when the payment
 * isn't there.
 *
 * Deliberately not a database column. Recording the account per booking would
 * be more direct, but it needs a migration run by hand on two databases, and
 * this reads the answer from Stripe itself, which cannot drift.
 */
export async function stripeForPayment(
  locationId: string,
  paymentIntentId: string
): Promise<Stripe> {
  const own = stripeFor(locationId)
  if (locationId === LEGACY_LOCATION_ID) return own

  try {
    await own.paymentIntents.retrieve(paymentIntentId)
    return own
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'resource_missing') {
      console.warn(
        `[stripe] ${paymentIntentId} is not on the ${locationId} account; ` +
        `falling back to the original account (pre-split payment).`
      )
      return stripeFor(LEGACY_LOCATION_ID)
    }
    throw err
  }
}

/**
 * Every account's webhook signing secret, for verifying an incoming event.
 * All three endpoints point at the same URL, so the only way to know which
 * account sent an event is to find the secret its signature verifies against.
 */
export function webhookSecrets(): { locationId: string; secret: string }[] {
  return Object.entries(ENV_SUFFIX)
    .map(([locationId, suffix]) => ({
      locationId,
      secret: process.env[`STRIPE_WEBHOOK_SECRET${suffix}`],
    }))
    .filter((s): s is { locationId: string; secret: string } => !!s.secret)
}
