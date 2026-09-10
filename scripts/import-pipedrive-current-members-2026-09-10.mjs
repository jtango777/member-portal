#!/usr/bin/env node
/**
 * BizHaus — Catch-up import of Pipedrive current members (2026-09-10)
 *
 * The original import (scripts/import-pipedrive-current-members.mjs) ran
 * once off a CSV snapshot from 2026-07-27 and was never re-run. Anyone
 * flagged "Current Member? = Yes" in Pipedrive after that date had no path
 * into the portal at all. This catches up that gap using a live pull from
 * the Pipedrive API (not a manual CSV export), reading from
 * /tmp/insert_plan.json — {name, email, org, portalLocationId}[] — built by
 * cross-referencing a fresh Pipedrive persons pull against permitted_emails.
 *
 * Same shape as the original: adds to permitted_emails as pending (no
 * invite sent yet), tagged with `source` so this batch can be found/undone:
 *   SELECT * FROM permitted_emails WHERE source = '<SOURCE_TAG>';
 *   DELETE FROM permitted_emails WHERE source = '<SOURCE_TAG>';   -- undo
 *
 * Usage:
 *   node scripts/import-pipedrive-current-members-2026-09-10.mjs --dry-run
 *   node scripts/import-pipedrive-current-members-2026-09-10.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join }            from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN    = process.argv.includes('--dry-run')
const SOURCE_TAG = 'pipedrive-current-members-2026-09-10'
const PLAN_FILE  = '/tmp/insert_plan.json'

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) { console.error('❌  .env.local not found.'); process.exit(1) }
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

function cleanEmail(raw) {
  return (raw ?? '').trim().toLowerCase().replace(/[`'"]/g, '')
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('❌  Supabase env vars missing from .env.local'); process.exit(1) }
  if (!existsSync(PLAN_FILE)) { console.error(`❌  ${PLAN_FILE} not found.`); process.exit(1) }

  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf-8'))
  console.log(`\n👥  BizHaus Pipedrive catch-up import${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    Rows in plan : ${plan.length}`)
  console.log(`    Source tag   : ${SOURCE_TAG}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: companies } = await db.from('companies').select('id, name')
  const companyIdByName = new Map(companies.map(c => [c.name.toLowerCase(), c.id]))

  const { data: existingRows } = await db.from('permitted_emails').select('email')
  const existingEmails = new Set(existingRows.map(r => cleanEmail(r.email)))

  let added = 0, skippedExisting = 0, failed = 0
  const seenThisRun = new Set()

  for (const row of plan) {
    const email = cleanEmail(row.email)
    if (!email) continue
    if (existingEmails.has(email) || seenThisRun.has(email)) { skippedExisting++; continue }
    seenThisRun.add(email)

    const orgName = row.org?.trim() || row.name?.trim()
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

    const fullName = (row.name && row.name.toLowerCase() !== email) ? row.name : null

    if (DRY_RUN) {
      console.log(`  [dry] ${email}  |  ${fullName ?? '(no name)'}  |  ${orgName}  |  ${row.portalLocationId ?? '(no location)'}`)
      added++
      continue
    }

    const { error } = await db.from('permitted_emails').insert({
      email,
      full_name:           fullName,
      company_id:          companyId,
      default_location_id: row.portalLocationId ?? null,
      invite_token:        null,
      invited_at:          new Date().toISOString(),
      accepted_at:         null,
      source:              SOURCE_TAG,
    })

    if (error) { console.error(`  ✗ ${email}: ${error.message}`); failed++ }
    else added++
  }

  console.log(`\nAdded: ${added}  |  Failed: ${failed}  |  Already existed: ${skippedExisting}\n`)
  console.log(DRY_RUN
    ? '✅  Dry run complete — re-run without --dry-run to actually add these.\n'
    : `✅  Import complete! To undo this exact batch later:\n   DELETE FROM permitted_emails WHERE source = '${SOURCE_TAG}';\n`)
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
