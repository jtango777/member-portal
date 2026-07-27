#!/usr/bin/env node
/**
 * BizHaus — Data Import Script
 *
 * Reads the exported Company List and User List CSVs and populates Supabase.
 *
 * Usage:
 *   node scripts/import-data.mjs               # uses default paths (Desktop)
 *   node scripts/import-data.mjs --dry-run      # preview without writing anything
 *   node scripts/import-data.mjs /path/to/companies.csv /path/to/users.csv
 *
 * After running this, users are on the permitted-email list but have NOT been
 * sent invite emails yet. Run scripts/send-invites.mjs to send them.
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join, resolve }   from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')

// ── Environment ──────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌  .env.local not found. Copy .env.local.example and fill in your keys first.')
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

// ── CSV parsing ───────────────────────────────────────────────────────────────

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

// "46/month shared" → 46 | "Unlimited" → 9999
function parseHours(str) {
  if (!str) return 0
  const s = str.trim().toLowerCase()
  if (s.includes('unlimited')) return 9999
  const m = s.match(/^(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

// Strip stray characters that sneak in from CSV exports
function cleanEmail(raw) {
  return (raw ?? '').trim().toLowerCase().replace(/[`'"]/g, '')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local')
    process.exit(1)
  }

  // Resolve CSV file paths
  const positional  = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const desktopDir  = join(__dirname, '..', '..')
  const companyFile = resolve(positional[0] ?? join(desktopDir, 'BizHaus - Company List.csv'))
  const userFile    = resolve(positional[1] ?? join(desktopDir, 'BizHaus - User List.csv'))

  for (const [label, path] of [['Company list', companyFile], ['User list', userFile]]) {
    if (!existsSync(path)) {
      console.error(`❌  ${label} not found at: ${path}`)
      console.error('    Pass the paths as arguments: node scripts/import-data.mjs <companies.csv> <users.csv>')
      process.exit(1)
    }
  }

  console.log(`\n🏢  BizHaus data import${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    Company CSV : ${companyFile}`)
  console.log(`    User CSV    : ${userFile}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const companyRows = parseCSV(companyFile)
  const userRows    = parseCSV(userFile)

  // ── Step 1: Companies ───────────────────────────────────────────────────────

  console.log(`Step 1/2 — Companies  (${companyRows.length} rows in CSV)`)

  // Build a map of existing companies so we don't re-insert them
  const { data: existingCos } = await db.from('companies').select('id, name')
  const companyMap = new Map((existingCos ?? []).map(c => [c.name, c.id]))

  let coCreated = 0, coExisted = 0, coFailed = 0

  for (const row of companyRows) {
    const name = row['Company Name']?.trim()
    if (!name) continue

    if (companyMap.has(name)) { coExisted++; continue }

    const hours = parseHours(row['Allocated Hours'])

    if (DRY_RUN) {
      console.log(`  [dry] "${name}"  ${hours}h/mo`)
      companyMap.set(name, `dry-${name}`)
      coCreated++
      continue
    }

    const { data, error } = await db
      .from('companies')
      .insert({ name, monthly_hours_allotment: hours })
      .select('id')
      .single()

    if (error) {
      console.error(`  ✗ "${name}": ${error.message}`)
      coFailed++
    } else {
      companyMap.set(name, data.id)
      coCreated++
    }
  }

  console.log(`  Created: ${coCreated}  |  Already existed: ${coExisted}  |  Failed: ${coFailed}\n`)

  // ── Step 2: Users → permitted_emails ────────────────────────────────────────

  const activeUsers = userRows.filter(r => {
    const disabled = r['Account Disabled']?.trim().toLowerCase()
    return disabled !== 'true' && r['Email']?.trim()
  })

  console.log(`Step 2/2 — Users  (${activeUsers.length} active out of ${userRows.length} total rows)`)

  // Pre-fetch existing permitted emails to avoid duplicates
  const { data: existingEmails } = await db.from('permitted_emails').select('email')
  const emailSet = new Set((existingEmails ?? []).map(e => e.email))

  let usAdded = 0, usSkipped = 0, usBadEmail = 0, usNoCompany = 0

  for (const row of activeUsers) {
    const email       = cleanEmail(row['Email'])
    const companyName = row['Company Name']?.trim() ?? ''
    const fullName    = [row['First Name']?.trim(), row['Last Name']?.trim()].filter(Boolean).join(' ') || null

    if (!email || !email.includes('@') || !email.includes('.')) {
      console.warn(`  ⚠ Skipping invalid email: "${row['Email']}"`)
      usBadEmail++
      continue
    }

    if (emailSet.has(email)) { usSkipped++; continue }

    // Look up company; auto-create if it appeared only in the user list
    let companyId = companyMap.get(companyName)
    if (!companyId && companyName) {
      if (DRY_RUN) {
        companyId = `dry-${companyName}`
        companyMap.set(companyName, companyId)
        console.log(`  [dry] Auto-create company: "${companyName}"`)
      } else {
        const { data, error } = await db
          .from('companies')
          .insert({ name: companyName, monthly_hours_allotment: 0 })
          .select('id')
          .single()
        if (data) {
          companyId = data.id
          companyMap.set(companyName, companyId)
          console.log(`  + Auto-created company: "${companyName}"`)
        } else {
          console.warn(`  ⚠ Could not create company "${companyName}" for ${email}: ${error?.message}`)
        }
      }
    }

    if (!companyId) { usNoCompany++; continue }

    if (DRY_RUN) { usAdded++; continue }

    const { error } = await db.from('permitted_emails').insert({
      email,
      full_name:   fullName,
      company_id:  companyId,
      invite_token: null,        // token generated when invite email is sent
      invited_at:  new Date().toISOString(),
      accepted_at: null,
    })

    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`)
    } else {
      emailSet.add(email)
      usAdded++
    }
  }

  console.log(`  Added: ${usAdded}  |  Already existed: ${usSkipped}  |  Bad email: ${usBadEmail}  |  No company: ${usNoCompany}\n`)

  console.log('✅  Import complete!\n')
  console.log('Next steps:')
  console.log('  • Users are on the permitted-email list but have NOT been sent invite emails yet.')
  console.log('  • Send invites in batches with:  node scripts/send-invites.mjs --limit 50')
  console.log('  • Or invite individuals via Admin → Members → Resend.\n')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
