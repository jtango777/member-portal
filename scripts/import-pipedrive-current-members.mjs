#!/usr/bin/env node
/**
 * BizHaus — Import current members from Pipedrive
 *
 * Adds people from the Pipedrive "current members" export who aren't
 * already in permitted_emails. This is the group that was excluded when
 * BizHaus was getaroom-only and only some members needed access — now
 * that it's a full portal, everyone current needs an account.
 *
 * Every row this script creates is tagged with `source`, so this exact
 * batch can always be found and undone later:
 *   SELECT * FROM permitted_emails WHERE source = '<SOURCE_TAG>';
 *   DELETE FROM permitted_emails WHERE source = '<SOURCE_TAG>';   -- undo
 *
 * If someone has no Organization in Pipedrive, their own name is used as
 * the company (same fallback the original getaroom import used).
 *
 * Usage:
 *   node scripts/import-pipedrive-current-members.mjs --dry-run
 *   node scripts/import-pipedrive-current-members.mjs
 *   node scripts/import-pipedrive-current-members.mjs /path/to/people.csv
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join, resolve }   from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')
const SOURCE_TAG = 'pipedrive-current-members-2026-07-27'

// People to explicitly exclude from this batch (by email), even if present in the export.
const EXCLUDE_EMAILS = new Set([
  'macymoliveras@gmail.com',
])

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
  const peopleFile = resolve(positional[0] ?? join(__dirname, '.tmp-pipedrive-people.csv'))

  if (!existsSync(peopleFile)) {
    console.error(`❌  Pipedrive people CSV not found at: ${peopleFile}`)
    process.exit(1)
  }

  console.log(`\n👥  BizHaus Pipedrive current-member import${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    People CSV : ${peopleFile}`)
  console.log(`    Source tag : ${SOURCE_TAG}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: locations, error: locErr } = await db.from('locations').select('id, name')
  if (locErr) { console.error('❌  Failed to fetch locations:', locErr.message); process.exit(1) }
  const locIdByName = new Map(locations.map(l => [l.name.toLowerCase(), l.id]))

  const { data: companies, error: coErr } = await db.from('companies').select('id, name')
  if (coErr) { console.error('❌  Failed to fetch companies:', coErr.message); process.exit(1) }
  const companyIdByName = new Map(companies.map(c => [c.name.toLowerCase(), c.id]))

  const { data: existingRows, error: peErr } = await db.from('permitted_emails').select('email')
  if (peErr) { console.error('❌  Failed to fetch permitted_emails:', peErr.message); process.exit(1) }
  const existingEmails = new Set(existingRows.map(r => cleanEmail(r.email)))

  const peopleRows = parseCSV(peopleFile)

  let added = 0, skippedExisting = 0, skippedExcluded = 0, skippedNoEmail = 0, failed = 0
  const seenThisRun = new Set()

  for (const row of peopleRows) {
    const emails = ['Email Work', 'Email Home', 'Email Other']
      .map(c => cleanEmail(row[c]))
      .filter(Boolean)
    if (emails.length === 0) { skippedNoEmail++; continue }

    const email = emails[0]
    if (EXCLUDE_EMAILS.has(email) || emails.some(e => EXCLUDE_EMAILS.has(e))) { skippedExcluded++; continue }
    if (existingEmails.has(email) || emails.some(e => existingEmails.has(e))) { skippedExisting++; continue }
    if (seenThisRun.has(email)) continue  // duplicate row in the export itself
    seenThisRun.add(email)

    const name = row['Name']?.trim()
    const orgName = row['Organization']?.trim() || name  // fallback: person's own name, same as original getaroom import
    if (!orgName) { skippedNoEmail++; continue }

    let companyId = companyIdByName.get(orgName.toLowerCase())
    if (!companyId) {
      if (DRY_RUN) {
        companyId = `dry-${orgName}`
        companyIdByName.set(orgName.toLowerCase(), companyId)
      } else {
        const { data, error } = await db.from('companies').insert({ name: orgName, monthly_hours_allotment: 0 }).select('id').single()
        if (error) { console.error(`  ✗ company "${orgName}": ${error.message}`); failed++; continue }
        companyId = data.id
        companyIdByName.set(orgName.toLowerCase(), companyId)
      }
    }

    const locRaw = row['Location']?.split(',')[0]?.trim()
    const locationId = locRaw ? locIdByName.get(locRaw.toLowerCase()) ?? null : null

    // Skip person-name-as-email placeholders (e.g. "chirag@pushhealth.com" as both name and email)
    const fullName = (name && name.toLowerCase() !== email) ? name : null

    if (DRY_RUN) {
      console.log(`  [dry] ${email}  |  ${fullName ?? '(no name)'}  |  ${orgName}  |  ${locRaw || '(no location)'}`)
      added++
      continue
    }

    const { error } = await db.from('permitted_emails').insert({
      email,
      full_name:           fullName,
      company_id:          companyId,
      default_location_id: locationId,
      invite_token:        null,
      invited_at:          new Date().toISOString(),
      accepted_at:         null,
      source:              SOURCE_TAG,
    })

    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`)
      failed++
    } else {
      added++
    }
  }

  console.log(`\nAdded: ${added}  |  Failed: ${failed}`)
  console.log(`Already in BizHaus (untouched): ${skippedExisting}`)
  console.log(`Explicitly excluded: ${skippedExcluded}`)
  console.log(`No usable email/name: ${skippedNoEmail}\n`)
  console.log(DRY_RUN
    ? '✅  Dry run complete — re-run without --dry-run to actually add these.\n'
    : `✅  Import complete! To undo this exact batch later:\n   DELETE FROM permitted_emails WHERE source = '${SOURCE_TAG}';\n`)
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
