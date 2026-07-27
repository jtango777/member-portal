#!/usr/bin/env node
/**
 * BizHaus — Backfill member locations
 *
 * Matches emails in the Pipedrive "people" export (converted to CSV, with
 * "Email Work" / "Email Home" / "Email Other" / "Location" columns) against
 * everyone already in permitted_emails, and fills in default_location_id
 * where it's currently blank — on profiles for people who've signed up, or
 * on permitted_emails itself (as a preset) for people who haven't yet. If
 * someone has multiple locations listed, the first one is used.
 *
 * Does NOT add new members and does NOT overwrite anyone's location if
 * it's already set.
 *
 * Usage:
 *   node scripts/backfill-member-locations.mjs --dry-run
 *   node scripts/backfill-member-locations.mjs
 *   node scripts/backfill-member-locations.mjs /path/to/people-locations.csv
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join, resolve }   from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌  .env.local not found.')
    process.exit(1)
  }
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

function parseCSV(filePath) {
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim())
  if (lines.length === 0) return []
  const headers = parseRow(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = parseRow(line)
    const row  = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
}

function parseRow(line) {
  const result = []
  let current  = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function cleanEmail(raw) {
  return (raw ?? '').trim().toLowerCase().replace(/[`'"]/g, '')
}

async function main() {
  loadEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local')
    process.exit(1)
  }

  const positional = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const peopleFile = resolve(positional[0] ?? join(__dirname, '..', 'scripts', '.tmp-people-locations.csv'))

  if (!existsSync(peopleFile)) {
    console.error(`❌  People CSV not found at: ${peopleFile}`)
    process.exit(1)
  }

  console.log(`\n📍  BizHaus location backfill${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    People CSV : ${peopleFile}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // ── Load locations table ────────────────────────────────────────────────────
  const { data: locations, error: locErr } = await db.from('locations').select('id, name')
  if (locErr) {
    console.error('❌  Failed to fetch locations:', locErr.message)
    process.exit(1)
  }
  const locIdByName = new Map(locations.map(l => [l.name.toLowerCase(), l.id]))

  // ── Build email → first location map from the CSV ──────────────────────────
  const peopleRows = parseCSV(peopleFile)
  const locationByEmail = new Map()
  for (const row of peopleRows) {
    const locRaw = row['Location']
    if (!locRaw) continue
    const firstLocation = locRaw.split(',')[0].trim()
    const locId = locIdByName.get(firstLocation.toLowerCase())
    if (!locId) continue

    for (const col of ['Email Work', 'Email Home', 'Email Other']) {
      const email = cleanEmail(row[col])
      if (email) locationByEmail.set(email, { name: firstLocation, id: locId })
    }
  }
  console.log(`People rows with a usable, matching location: ${locationByEmail.size}\n`)

  // ── Existing permitted_emails, joined to profiles via auth email ───────────
  const { data: permitted, error: peErr } = await db.from('permitted_emails').select('id, email, default_location_id')
  if (peErr) {
    console.error('❌  Failed to fetch permitted_emails:', peErr.message)
    process.exit(1)
  }
  const { data: { users: authUsers } } = await db.auth.admin.listUsers({ perPage: 1000 })
  const authIdByEmail = new Map((authUsers ?? []).map(u => [cleanEmail(u.email), u.id]))

  const { data: profiles, error: profErr } = await db.from('profiles').select('id, default_location_id')
  if (profErr) {
    console.error('❌  Failed to fetch profiles:', profErr.message)
    process.exit(1)
  }
  const profileById = new Map(profiles.map(p => [p.id, p]))

  let matched = 0, updated = 0, alreadySet = 0, noLocationMatch = 0, failed = 0
  let matchedSignedUp = 0, matchedPending = 0

  for (const pe of permitted ?? []) {
    const email  = cleanEmail(pe.email)
    const authId = authIdByEmail.get(email)
    const profile = authId ? profileById.get(authId) : null
    const signedUp = !!profile

    const currentLocation = signedUp ? profile.default_location_id : pe.default_location_id
    if (currentLocation) { alreadySet++; continue }  // don't overwrite

    const loc = locationByEmail.get(email)
    if (!loc) { noLocationMatch++; continue }

    matched++
    signedUp ? matchedSignedUp++ : matchedPending++

    if (DRY_RUN) {
      console.log(`  [dry] ${email} → ${loc.name}${signedUp ? ' (profile)' : ' (preset on invite)'}`)
      continue
    }

    const { error } = signedUp
      ? await db.from('profiles').update({ default_location_id: loc.id }).eq('id', authId)
      : await db.from('permitted_emails').update({ default_location_id: loc.id }).eq('id', pe.id)

    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`)
      failed++
    } else {
      updated++
    }
  }

  console.log(`\nMatched, blank location, location found: ${matched}  (${matchedSignedUp} signed-up profiles, ${matchedPending} preset on pending invites)`)
  if (!DRY_RUN) console.log(`Updated: ${updated}  |  Failed: ${failed}`)
  console.log(`Already had a location (untouched): ${alreadySet}`)
  console.log(`Blank location, but no match in export (untouched): ${noLocationMatch}\n`)
  console.log(DRY_RUN ? '✅  Dry run complete — re-run without --dry-run to write these changes.\n' : '✅  Backfill complete!\n')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
