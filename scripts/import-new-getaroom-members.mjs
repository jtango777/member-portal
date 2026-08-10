#!/usr/bin/env node
/**
 * BizHaus — Import newly-added getaroom members
 *
 * Adds the small set of people who appeared on a fresh getaroom export
 * (User List (2).csv) but aren't yet in the portal and weren't part of
 * the original getaroom→Pipedrive exclusion list. Companies with no known
 * hour allotment are created at 0 hours (no source has that data yet).
 *
 * Tagged with `source` so this batch can be found/undone later:
 *   DELETE FROM permitted_emails WHERE source = 'getaroom-list2-new-2026-08-10';
 *
 * Usage:
 *   node scripts/import-new-getaroom-members.mjs --dry-run
 *   node scripts/import-new-getaroom-members.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join }            from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')
const SOURCE_TAG = 'getaroom-list2-new-2026-08-10'

const PEOPLE = [
  { name: 'Alex Mortensen',     email: 'alex.mortensen@hiseas.com', company: 'Hiseas' },
  { name: 'Anton Lee',          email: 'anton@agathus.com',         company: 'Agathus' },
  { name: 'Ashley Shuolin He',  email: 'ashley@agathus.com',        company: 'Agathus' },
  { name: 'Chad Saechao',       email: 'chad@agathus.com',          company: 'Agathus' },
  { name: 'Francesca Palanca',  email: 'francesca@agathus.com',     company: 'Agathus' },
  { name: 'Gerald (Jerry) Chen',email: 'jerry@agathus.com',         company: 'Agathus' },
  { name: 'Haley Hanson',       email: 'haley@agathus.com',         company: 'Agathus' },
  { name: 'Haran Chen',         email: 'haran@agathus.com',         company: 'Agathus' },
  { name: 'Juan Ramirez',       email: 'juan@agathus.com',          company: 'Agathus' },
  { name: 'Kelly Kang',         email: 'kelly@agathus.com',         company: 'Agathus' },
  { name: 'Nicole Janes',       email: 'nicole@agathus.com',        company: 'Agathus' },
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

  console.log(`\n👥  Import newly-added getaroom members${DRY_RUN ? '  [DRY RUN]' : ''}`)
  console.log(`    Source tag: ${SOURCE_TAG}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: companies } = await db.from('companies').select('id, name')
  const companyIdByName = new Map(companies.map(c => [c.name.toLowerCase(), c.id]))

  const { data: existing } = await db.from('permitted_emails').select('email')
  const existingEmails = new Set(existing.map(r => r.email.toLowerCase().trim()))

  let added = 0, skipped = 0, failed = 0

  for (const p of PEOPLE) {
    const email = p.email.toLowerCase().trim()
    if (existingEmails.has(email)) { console.log(`  - skip (already on portal): ${email}`); skipped++; continue }

    let companyId = companyIdByName.get(p.company.toLowerCase())
    if (!companyId) {
      if (DRY_RUN) {
        console.log(`  [dry] would create company "${p.company}" at 0 hours`)
        companyId = `dry-${p.company}`
        companyIdByName.set(p.company.toLowerCase(), companyId)
      } else {
        const { data, error } = await db.from('companies').insert({ name: p.company, monthly_hours_allotment: 0 }).select('id').single()
        if (error) { console.error(`  ✗ company "${p.company}": ${error.message}`); failed++; continue }
        companyId = data.id
        companyIdByName.set(p.company.toLowerCase(), companyId)
        console.log(`  + created company "${p.company}" at 0 hours`)
      }
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${email}  |  ${p.name}  |  ${p.company}`)
      added++
      continue
    }

    const { error } = await db.from('permitted_emails').insert({
      email,
      full_name:    p.name,
      company_id:   companyId,
      invite_token: null,
      invited_at:   new Date().toISOString(),
      accepted_at:  null,
      source:       SOURCE_TAG,
    })

    if (error) { console.error(`  ✗ ${email}: ${error.message}`); failed++ }
    else { console.log(`  + ${email}`); added++ }
  }

  console.log(`\nAdded: ${added}  |  Skipped (already on portal): ${skipped}  |  Failed: ${failed}\n`)
  console.log(DRY_RUN
    ? '✅  Dry run complete — re-run without --dry-run to write these.\n'
    : `✅  Done! Undo with:\n   DELETE FROM permitted_emails WHERE source = '${SOURCE_TAG}';\n`)
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
