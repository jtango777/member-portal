#!/usr/bin/env node
/**
 * BizHaus — Report reservation CSV emails with no member match
 *
 * Read-only report (writes nothing). For each reservation CSV passed in,
 * runs the same Owner Email matching logic as import-monthly-reservations.mjs
 * against the CURRENT permitted_emails/profiles/auth data, and prints every
 * unique Owner Email that doesn't match anyone on file — these are exactly
 * the bookings that fall back to "Historical Booking" with no way to link
 * them, because the person isn't a recognized member at all (not a name-
 * matching issue).
 *
 * Usage:
 *   node scripts/report-unmatched-reservation-emails.mjs /path/to/a.csv /path/to/b.csv ...
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join, resolve }   from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

function parseCSV(filePath) {
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim())
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

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('❌  Missing Supabase env vars.'); process.exit(1) }

  const csvFiles = process.argv.slice(2).map(p => resolve(p))
  if (csvFiles.length === 0) {
    console.error('❌  Pass one or more CSV paths.')
    process.exit(1)
  }
  for (const f of csvFiles) {
    if (!existsSync(f)) { console.error(`❌  Not found: ${f}`); process.exit(1) }
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
  const authIdByEmail = new Map(users.map(u => [(u.email ?? '').toLowerCase(), u.id]))
  const { data: permitted } = await db.from('permitted_emails').select('email')
  const permittedEmails = new Set((permitted ?? []).map(p => p.email.toLowerCase()))

  // owner email (lowercased) -> { count, sampleTitle, sampleCompany, files: Set }
  const unmatched = new Map()

  for (const file of csvFiles) {
    const rows = parseCSV(file)
    for (const row of rows) {
      const ownerEmail = row['Owner Email']?.trim().toLowerCase()
      if (!ownerEmail) continue
      const hasAccount = authIdByEmail.has(ownerEmail)
      const isPermitted = permittedEmails.has(ownerEmail)
      if (hasAccount || isPermitted) continue // matched — not our concern here

      const entry = unmatched.get(ownerEmail) ?? {
        count: 0,
        name: `${row['User First Name'] ?? ''} ${row['User Last Name'] ?? ''}`.trim(),
        company: row['Other Company Name'] ?? '',
        files: new Set(),
      }
      entry.count++
      entry.files.add(file.split('/').pop())
      unmatched.set(ownerEmail, entry)
    }
  }

  const sorted = [...unmatched.entries()].sort((a, b) => b[1].count - a[1].count)

  console.log(`\nChecked ${csvFiles.length} file(s):`)
  csvFiles.forEach(f => console.log(`  - ${f.split('/').pop()}`))
  console.log(`\n${sorted.length} unique email(s) with NO member record at all (not in permitted_emails, no account):\n`)

  for (const [email, info] of sorted) {
    console.log(`  ${email}  (${info.count}x)  — ${info.name || '(no name in CSV)'} @ ${info.company || '—'}  [${[...info.files].join(', ')}]`)
  }
  console.log('')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
