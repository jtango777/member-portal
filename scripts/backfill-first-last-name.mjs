#!/usr/bin/env node
/**
 * BizHaus — Backfill first_name / last_name from full_name
 *
 * Splits the existing full_name into first_name/last_name for every row
 * (profiles and permitted_emails) that has a full_name but no first_name
 * or last_name yet. Split point is the first space — everything after it
 * becomes last_name (handles "Van Der Berg" etc. reasonably).
 *
 * Does NOT touch rows that already have first_name/last_name set (e.g.
 * anyone added/edited since the two-field forms went live), does NOT touch
 * full_name itself, and does NOT touch is_active/archive status — purely a
 * name-field split, nothing else about the row changes.
 *
 * Usage:
 *   node scripts/backfill-first-last-name.mjs --dry-run     # preview only
 *   node scripts/backfill-first-last-name.mjs               # actually write
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join }            from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) { console.error('❌  .env.local not found.'); process.exit(1) }
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

// "Jane Van Der Berg" -> { first: "Jane", last: "Van Der Berg" }
// "Cher"              -> { first: "Cher", last: "" }
function splitName(fullName) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ')
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { first: trimmed, last: '' }
  return { first: trimmed.slice(0, spaceIdx), last: trimmed.slice(spaceIdx + 1) }
}

async function backfillTable(db, table) {
  const { data: rows, error } = await db.from(table).select('id, full_name, first_name, last_name')
  if (error) { console.error(`❌  Failed to read ${table}:`, error.message); process.exit(1) }

  const toUpdate = (rows ?? [])
    .filter(r => (r.full_name ?? '').trim() && !r.first_name && !r.last_name)
    .map(r => ({ id: r.id, full_name: r.full_name, ...splitName(r.full_name) }))

  console.log(`\n${table}: ${rows.length} rows, ${toUpdate.length} need a first/last split`)

  if (toUpdate.length === 0) return { updated: 0, failed: 0 }

  console.log('Sample:')
  toUpdate.slice(0, 8).forEach(r => console.log(`  "${r.full_name}" -> first="${r.first}" last="${r.last}"`))

  if (DRY_RUN) return { updated: 0, failed: 0 }

  let updated = 0, failed = 0
  for (const r of toUpdate) {
    const { error: updErr } = await db.from(table)
      .update({ first_name: r.first, last_name: r.last || null })
      .eq('id', r.id)
    if (updErr) { console.error(`  ✗ ${r.id}: ${updErr.message}`); failed++ }
    else updated++
  }
  return { updated, failed }
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('❌  Missing Supabase env vars.'); process.exit(1) }

  console.log(`Backfill first_name/last_name from full_name${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const profilesResult = await backfillTable(db, 'profiles')
  const permittedResult = await backfillTable(db, 'permitted_emails')

  if (DRY_RUN) {
    console.log('\n✅  Dry run complete — re-run without --dry-run to write these.\n')
    return
  }

  console.log(`\nprofiles:         updated ${profilesResult.updated}, failed ${profilesResult.failed}`)
  console.log(`permitted_emails: updated ${permittedResult.updated}, failed ${permittedResult.failed}`)
  console.log('\n✅  Done!\n')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
