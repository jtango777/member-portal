#!/usr/bin/env node
/**
 * BizHaus — Add unmatched reservation bookers as pending members
 *
 * Adds the 12 people identified by report-unmatched-reservation-emails.mjs
 * (bookers in the July/Aug/Sept 2026 reservation CSVs with no member record
 * at all) as pending members — no invite sent, just makes them recognized
 * so their existing "Historical Booking" reservations link to a real
 * (pending) name via historical_email, and any future bookings from the
 * same email match automatically too.
 *
 * Never touches anyone already in permitted_emails (upsert only inserts
 * new rows here — see guard below), never sends an invite.
 *
 * Tagged with `source` so this batch can be found/undone later:
 *   DELETE FROM permitted_emails WHERE source = 'unmatched-reservations-2026-08-11';
 *
 * After adding, run scripts/relink-historical-reservations.mjs (or just
 * re-run this month's import script) to retag their past bookings.
 *
 * Usage:
 *   node scripts/add-unmatched-reservation-people.mjs --dry-run
 *   node scripts/add-unmatched-reservation-people.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join }            from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')
const SOURCE_TAG = 'unmatched-reservations-2026-08-11'

const PEOPLE = [
  { first: 'Chris',    last: 'Mazurk',    email: 'c.mazurk@intelitics.com',              company: 'Intelitics' },
  { first: 'Elizabeth',last: 'Post',      email: 'epost@waterskraus.com',                company: 'Waters Kraus' },
  { first: 'Christine',last: 'Newman',    email: 'c.newman@intelitics.com',              company: 'Intelitics' },
  { first: 'Joe',      last: 'Cohen',     email: 'joecohen@jscrei.com',                  company: 'JSC REI' },
  { first: 'Jessica',  last: 'Dowell',    email: 'jessica.dowell@integralforensics.com', company: 'Integral Forensics' },
  { first: 'Peter',    last: 'Kazanjian', email: 'peter.kazanjian@boxi.co',              company: 'Boxi' },
  { first: 'Nicole',   last: 'Lewis',     email: 'nlewis@apg-dev.com',                   company: 'Alliance Property Group' },
  { first: 'Darren',   last: 'Holt',      email: 'darren@intelitics.com',                company: 'Intelitics' },
  { first: 'Bryan',    last: 'Stone',     email: 'bryan@stoneharbormediagroup.com',      company: 'Stone Harbor Media Group' },
  { first: 'Mattie',   last: 'Meese',     email: 'mattie.m@equipandempower.org',         company: 'A21' },
  { first: 'Tyler',    last: 'Hogan',     email: 't.hogan@intelitics.com',               company: 'Intelitics' },
  { first: 'Andrew',   last: 'Alvarado',  email: 'a.alvarado@intelitics.com',            company: 'Intelitics' },
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

  console.log(`\nAdd unmatched reservation bookers as pending members${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}\n`)

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

    let companyId = companyIdByName.get(p.company.toLowerCase()) ?? null
    if (!companyId) {
      console.log(`  ⚠  no existing company match for "${p.company}" — will add with no company (individual, 0 hours)`)
    }

    const fullName = `${p.first} ${p.last}`.trim()
    console.log(`  + ${DRY_RUN ? '[dry] would add' : 'adding'}: ${fullName} <${email}> @ ${p.company}${companyId ? '' : ' (no company match)'}`)

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
    console.log('✅  Done! Now re-run the reservation import scripts for July/Aug/Sept so their existing bookings pick up the historical_email tag and link to these new pending records.\n')
  }
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
