import type { SupabaseClient } from '@supabase/supabase-js'

// One QuickBooks sales receipt per booking (migration 063). The booking
// route and the Stripe webhook can both reach the receipt step for the same
// booking at the same moment; each must claim the row first, and only the
// one that gets the claim talks to QuickBooks. The claim is a single
// conditional update, so the database decides who wins, not timing.

type ReceiptTable = 'day_passes' | 'external_bookings'

// A claim this old with still no receipt means the path that took it died
// part way through, so the other one may take over.
const ABANDONED_AFTER_MS = 10 * 60 * 1000

/** True when this caller now owns making the receipt for this row. */
export async function claimForReceipt(admin: SupabaseClient, table: ReceiptTable, id: string): Promise<boolean> {
  const abandonedBefore = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString()
  const { data, error } = await admin
    .from(table)
    .update({ qb_receipt_claimed_at: new Date().toISOString() })
    .eq('id', id)
    .is('qb_receipt_id', null)
    .or(`qb_receipt_claimed_at.is.null,qb_receipt_claimed_at.lt."${abandonedBefore}"`)
    .select('id')

  if (error) {
    // Most likely migration 063 hasn't been run. Go ahead unclaimed, which
    // is how it behaved before: a rare duplicate beats a missing receipt.
    console.error(`[qb] Could not claim ${table} ${id} for its receipt (is migration 063 run?):`, error.message)
    return true
  }
  return (data?.length ?? 0) > 0
}

/** Gives the claim back after a failed attempt, so the other path may retry. */
export async function releaseReceiptClaim(admin: SupabaseClient, table: ReceiptTable, id: string) {
  const { error } = await admin
    .from(table)
    .update({ qb_receipt_claimed_at: null })
    .eq('id', id)
    .is('qb_receipt_id', null)
  if (error) console.error(`[qb] Could not release the receipt claim on ${table} ${id}:`, error.message)
}
