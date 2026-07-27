#!/usr/bin/env node
/**
 * BizHaus — Backfill member names
 *
 * Matches emails in the getaroom "User List" CSV to existing permitted_emails
 * rows and fills in full_name where it's currently blank. Does NOT add new
 * members, does NOT touch anyone whose full_name is already set (e.g. from
 * the Pipedrive cross-ref), and does NOT touch anything else about the row.
 *
 * Usage:
 *   node scripts/backfill-member-names.mjs --dry-run     # preview only
 *   node scripts/backfill-member-names.mjs               # actually write
 *   node scripts/backfill-member-names.mjs /path/to/users.csv
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
  const userFile    = resolve(positional[0] ?? '/Users/carolinesmith/Downloads/BizHaus - User List (1).csv')

  if (!existsSync(userFile)) {
    console.error(`❌  User list not found at: ${userFile}`)
    console.error('    Pass the path as an argument: node scripts/backfill-member-names.mjs <users.csv>')
    process.exit(1)
  }

  console.log(`\n🏷️   BizHaus name backfill${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    User CSV : ${userFile}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // Build email → name map from the CSV
  const userRows = parseCSV(userFile)
  const nameByEmail = new Map()
  for (const row of userRows) {
    const email    = cleanEmail(row['Email'])
    const fullName = [row['First Name']?.trim(), row['Last Name']?.trim()].filter(Boolean).join(' ')
    if (email && fullName) nameByEmail.set(email, fullName)
  }
  console.log(`CSV rows with a usable name: ${nameByEmail.size} / ${userRows.length}\n`)

  // Only touch existing permitted_emails rows with a blank full_name
  const { data: existing, error: fetchErr } = await db
    .from('permitted_emails')
    .select('id, email, full_name')

  if (fetchErr) {
    console.error('❌  Failed to fetch permitted_emails:', fetchErr.message)
    process.exit(1)
  }

  let matched = 0, updated = 0, alreadyNamed = 0, noMatch = 0, failed = 0

  for (const row of existing ?? []) {
    if (row.full_name && row.full_name.trim()) { alreadyNamed++; continue }

    const name = nameByEmail.get(cleanEmail(row.email))
    if (!name) { noMatch++; continue }

    matched++

    if (DRY_RUN) {
      console.log(`  [dry] ${row.email} → "${name}"`)
      continue
    }

    const { error } = await db.from('permitted_emails').update({ full_name: name }).eq('id', row.id)
    if (error) {
      console.error(`  ✗ ${row.email}: ${error.message}`)
      failed++
    } else {
      updated++
    }
  }

  console.log(`\nMatched blank names to CSV: ${matched}`)
  if (!DRY_RUN) console.log(`Updated: ${updated}  |  Failed: ${failed}`)
  console.log(`Already had a name (untouched): ${alreadyNamed}`)
  console.log(`No CSV match (untouched): ${noMatch}\n`)
  console.log(DRY_RUN ? '✅  Dry run complete — re-run without --dry-run to write these changes.\n' : '✅  Backfill complete!\n')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
