#!/usr/bin/env node
/**
 * BizHaus — Add remaining unmatched July reservation bookers as pending members
 *
 * Follow-up to add-unmatched-reservation-people.mjs, for the 4 people
 * still unmatched after the July 2026 (3).csv correction (report-unmatched-
 * reservation-emails.mjs run against the correct 292-row July file).
 *
 * Tagged with `source` so this batch can be found/undone later:
 *   DELETE FROM permitted_emails WHERE source = 'unmatched-reservations-2026-08-11-part2';
 *
 * Usage:
 *   node scripts/add-unmatched-reservation-people-2.mjs --dry-run
 *   node scripts/add-unmatched-reservation-people-2.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join }            from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')
const SOURCE_TAG = 'unmatched-reservations-2026-08-11-part2'

const PEOPLE = [
  { first: 'Olu',       last: 'Ishmael',    email: 'o-ishmael2012@nlaw.northwestern.edu', company: null },
  { first: 'Stephanie', last: 'Holt',       email: 's.holt@multivista.com',               company: 'Aperture/Multivista' },
  { first: 'Alan',      last: 'Bracewell',  email: 'alan@bracewellengineering.com',       company: null },
  { first: 'Joey',      last: 'Medina',     email: 'joeymedina@gmail.com',                company: null },
]

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

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('❌  Missing Supabase env vars.'); process.exit(1) }

  console.log(`\nAdd remaining unmatched July bookers as pending members${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: existing } = await db.from('permitted_emails').select('email')
  const existingEmails = new Set((existing ?? []).map(e => e.email.toLowerCase()))

  const { data: companies } = await db.from('companies').select('id, name')
  const companyIdByName = new Map((companies ?? []).map(c => [c.name.toLowerCase(), c.id]))

  let added = 0, skipped = 0, failed = 0

  for (const p of PEOPLE) {
    const email = p.email.toLowerCase().trim()
    if (existingEmails.has(email)) {
      console.log(`  ⏭  skip (already a member): ${email}`)
      skipped++
      continue
    }

    const companyId = p.company ? (companyIdByName.get(p.company.toLowerCase()) ?? null) : null
    if (p.company && !companyId) console.log(`  ⚠  no existing company match for "${p.company}"`)

    const fullName = `${p.first} ${p.last}`.trim()
    console.log(`  + ${DRY_RUN ? '[dry] would add' : 'adding'}: ${fullName} <${email}>${p.company ? ` @ ${p.company}` : ' (no company, individual)'}`)

    if (!DRY_RUN) {
      const { error } = await db.from('permitted_emails').upsert({
        email,
        first_name: p.first,
        last_name: p.last,
        full_name: fullName,
        company_id: companyId,
        source: SOURCE_TAG,
        invite_token: null,
        accepted_at: null,
      }, { onConflict: 'email' })
      if (error) { console.error(`    ✗ ${error.message}`); failed++; continue }
    }
    added++
  }

  console.log(`\n${DRY_RUN ? 'Would add' : 'Added'}: ${added}  |  Skipped (already members): ${skipped}  |  Failed: ${failed}\n`)

  if (DRY_RUN) {
    console.log('✅  Dry run complete — re-run without --dry-run to write these.\n')
  } else {
    console.log('✅  Done! Re-run the July import so their bookings pick up the historical_email tag.\n')
  }
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
