import { createAdminClient } from '@/lib/supabase/server'
import { DAY_PASS_PRICE_CENTS as FALLBACK_PRICE_CENTS } from '@/lib/dayPass'

// The day pass price and the closure-day list used to be constants in the
// code. They live in the database now so staff can change them from the
// admin dashboard without a developer (Caroline, 2026-09-25).
//
// Server-only: anything the browser needs comes through an API route or a
// server component's props, never by importing this file.

export type Closure = { date: string; name: string; blocks_day_pass: boolean; blocks_rooms: boolean }

// Both of these are read on nearly every booking request and change maybe a
// few times a year, so a short in-process cache keeps us off the database on
// the hot path. A price change takes at most this long to show up.
const CACHE_MS = 30_000
let priceCache:    { at: number; cents: number } | null = null
let closureCache:  { at: number; rows: Closure[] } | null = null

export function clearSettingsCache() {
  priceCache = null
  closureCache = null
}

export async function getDayPassPriceCents(): Promise<number> {
  if (priceCache && Date.now() - priceCache.at < CACHE_MS) return priceCache.cents

  const { data, error } = await createAdminClient()
    .from('app_settings')
    .select('value')
    .eq('key', 'day_pass_price_cents')
    .maybeSingle()

  // Never let a database hiccup make a day pass free: fall back to the old
  // constant, which is also what the table was seeded with.
  const cents = Number(data?.value)
  if (error || !Number.isFinite(cents) || cents <= 0) {
    if (error) console.error('[settings] Could not read the day pass price:', error.message)
    return FALLBACK_PRICE_CENTS
  }

  priceCache = { at: Date.now(), cents }
  return cents
}

export async function getClosures(): Promise<Closure[]> {
  if (closureCache && Date.now() - closureCache.at < CACHE_MS) return closureCache.rows

  const { data, error } = await createAdminClient()
    .from('closure_days')
    .select('date, name, blocks_day_pass, blocks_rooms')
    .order('date')

  if (error) {
    console.error('[settings] Could not read closure days:', error.message)
    return closureCache?.rows ?? []
  }

  const rows = (data ?? []) as Closure[]
  closureCache = { at: Date.now(), rows }
  return rows
}

/** `{ "2026-12-25": "Christmas Day" }` for whichever product is asking. */
export async function getClosureMap(product: 'day_pass' | 'rooms'): Promise<Record<string, string>> {
  const rows = await getClosures()
  const map: Record<string, string> = {}
  for (const r of rows) {
    if (product === 'day_pass' ? r.blocks_day_pass : r.blocks_rooms) map[r.date] = r.name
  }
  return map
}
