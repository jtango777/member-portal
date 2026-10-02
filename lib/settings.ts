import { createAdminClient } from '@/lib/supabase/server'
import { DAY_PASS_PRICE_CENTS as FALLBACK_PRICE_CENTS } from '@/lib/dayPass'
import { DEFAULT_COPY } from '@/lib/emailCopy'

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
let copyCache:     { at: number; copy: Record<string, string> } | null = null

export function clearSettingsCache() {
  priceCache = null
  closureCache = null
  copyCache = null
  doorCache = null
}

let doorCache: { at: number; codes: Record<string, string> } | null = null

/**
 * Door codes by location name. Lives in the database rather than the code
 * because a door code changes without warning and the confirmation email is
 * the only thing between a day passer and a locked door (Caroline,
 * 2026-10-01).
 */
export async function getDoorCodes(): Promise<Record<string, string>> {
  if (doorCache && Date.now() - doorCache.at < CACHE_MS) return doorCache.codes

  const { data, error } = await createAdminClient()
    .from('locations')
    .select('name, door_code')

  if (error) {
    console.error('[settings] Could not read door codes:', error.message)
    return doorCache?.codes ?? {}
  }

  const codes: Record<string, string> = {}
  for (const row of data ?? []) if (row.door_code) codes[row.name] = row.door_code
  doorCache = { at: Date.now(), codes }
  return codes
}

/**
 * The editable wording for customer emails, defaults filled in for anything
 * staff have not overridden. A blank override counts as not set, so clearing
 * a box in the admin screen restores the default.
 */
export async function getEmailCopy(): Promise<Record<string, string>> {
  if (copyCache && Date.now() - copyCache.at < CACHE_MS) return copyCache.copy

  const { data, error } = await createAdminClient()
    .from('app_settings')
    .select('value')
    .eq('key', 'email_copy')
    .maybeSingle()

  // Never let a database hiccup send a half-written email: fall back to the
  // wording in the code.
  if (error) {
    console.error('[settings] Could not read email copy:', error.message)
    return { ...DEFAULT_COPY }
  }

  const overrides = (data?.value ?? {}) as Record<string, unknown>
  const copy = { ...DEFAULT_COPY }
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string' && value.trim()) copy[key] = value
  }

  copyCache = { at: Date.now(), copy }
  return copy
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
