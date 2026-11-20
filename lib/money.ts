/**
 * Money, written the way a price is written.
 *
 * Always two decimal places, including on a round number. The booking
 * pages used to drop ".00" and show "$50" next to a "$39.00" on the same
 * screen, which reads as a rough figure rather than a price
 * (Caroline, 2026-11-20).
 *
 * There were two copies of this, one per page, and only one of them was
 * ever fixed at a time.
 */
export function money(amount: number) {
  return `$${amount.toFixed(2)}`
}
