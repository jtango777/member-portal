// Shared day-pass rules used by both the browser page and the API routes —
// kept out of the route file so the client bundle never pulls server code in.
export const DAY_PASS_PRICE_CENTS = 3000

// One purchase covers at most this many days — anything longer is really a
// membership conversation, not a self-serve checkout (Caroline, 2026-09-15).
export const MAX_DAY_PASS_DAYS = 10
export const MAX_DAYS_MESSAGE = `You can book up to ${MAX_DAY_PASS_DAYS} days at once. For a longer stay, email hello@bizhaus.com and we'll sort out a better rate.`
