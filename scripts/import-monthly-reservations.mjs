#!/usr/bin/env node
/**
 * BizHaus — Load a month of historical reservation data for preview
 *
 * Generalized version of import-july-reservations.mjs — takes any
 * Nexudus/getaroom reservation export and loads it into the `reservations`
 * table so it's visible in the portal's calendar/reports. The date range to
 * clear/replace is derived from the CSV itself, so this works for any month.
 *
 * Each booking's "Owner Email" is matched against permitted_emails:
 *   - Already has a real account  -> linked directly to their real profile.
 *   - Known but hasn't signed up yet (pending) -> attributed to a neutral
 *     "Historical Booking" placeholder for now, but tagged with
 *     historical_email so /api/invites/accept(-by-email) can reassign it to
 *     their real account the moment they sign up.
 *   - Not a member at all -> placeholder, untagged.
 * Company is matched against the existing Companies table wherever
 * possible, falling back to a generic "External Booking (Legacy)" company.
 *
 * Clears existing reservations in the CSV's date range first, then inserts
 * fresh — this is a full replace of that range, not an append.
 *
 * Usage:
 *   node scripts/import-monthly-reservations.mjs /path/to/reservations.csv --dry-run
 *   node scripts/import-monthly-reservations.mjs /path/to/reservations.csv
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { fileURLToPath }            from 'url'
import { dirname, join, resolve }   from 'path'
import { randomUUID }               from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')

// CSV "Room Name" -> DB room name (rooms are further disambiguated by building/location)
const ROOM_NAME_MAP = {
  'Library - West':        'Library West',
  'Library - East':        'Library East',
  'Board Room - Apple TV': 'Board Room w/ Apple TV',
  'Servco - Apple TV':     'Servco w/ Apple TV',
  'Left - Phone Booth':    'Left Phone Booth',
  'Right - Phone Booth':   'Right Phone Booth',
  'Large Conference':  'Large Conference',
  'Medium Conference': 'Medium Conference',
  'Small Meeting':     'Small Meeting',
  'Conference Room':   'Conference Room',
  'Library':            'Library',
}

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

// "2026-07-01 09:00:00 -0700" -> ISO 8601
function toISO(tzString) {
  if (!tzString) return null
  const m = tzString.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/)
  if (!m) return null
  const [, date, time, offset] = m
  const offsetFormatted = `${offset.slice(0, 3)}:${offset.slice(3)}`
  return `${date}T${time}${offsetFormatted}`
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('❌  Missing Supabase env vars.'); process.exit(1) }

  const positional = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const csvFile = positional[0] ? resolve(positional[0]) : null
  if (!csvFile || !existsSync(csvFile)) {
    console.error('❌  Pass the CSV path: node scripts/import-monthly-reservations.mjs /path/to/file.csv [--dry-run]')
    process.exit(1)
  }

  console.log(`\n📅  Load historical reservations for preview${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    CSV: ${csvFile}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: rooms } = await db.from('rooms').select('id, name, locations(name)')
  const roomIdByKey = new Map(rooms.map(r => [`${r.name}::${r.locations.name}`, r.id]))

  const PLACEHOLDER_EMAIL = 'legacy-bookings@bizhaus.internal'
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
  let placeholder = users.find(u => u.email === PLACEHOLDER_EMAIL)
  if (!placeholder) {
    if (DRY_RUN) {
      console.log(`  [dry] would create placeholder account: ${PLACEHOLDER_EMAIL}`)
      placeholder = { id: 'dry-placeholder' }
    } else {
      const { data: created, error } = await db.auth.admin.createUser({
        email: PLACEHOLDER_EMAIL,
        password: randomUUID(),
        email_confirm: true,
      })
      if (error) { console.error('❌  Failed to create placeholder account:', error.message); process.exit(1) }
      placeholder = created.user
      await db.from('profiles').insert({ id: placeholder.id, full_name: 'Historical Booking', is_admin: false, is_active: false })
      console.log(`  + created placeholder account: ${PLACEHOLDER_EMAIL}`)
    }
  }

  const { data: companies } = await db.from('companies').select('id, name')
  const companyIdByName = new Map(companies.map(c => [c.name.toLowerCase(), c.id]))
  const FALLBACK_CO_NAME = 'External Booking (Legacy)'
  let fallbackCoId = companyIdByName.get(FALLBACK_CO_NAME.toLowerCase())

  const { data: permitted } = await db.from('permitted_emails').select('email, accepted_at, company_id')
  const permittedByEmail = new Map(permitted.map(p => [p.email.toLowerCase(), p]))
  const authIdByEmail = new Map(users.map(u => [(u.email ?? '').toLowerCase(), u.id]))
  const { data: profiles } = await db.from('profiles').select('id, company_id')
  const profileById = new Map(profiles.map(p => [p.id, p]))

  const rows = parseCSV(csvFile)
  console.log(`CSV rows: ${rows.length}\n`)

  const toInsert = []
  let noRoomMatch = 0, badDates = 0, matchedCompany = 0, fallbackCompany = 0
  let linkedActive = 0, linkedPending = 0, linkedNone = 0
  let minStart = null, maxStart = null

  for (const row of rows) {
    const mappedName = ROOM_NAME_MAP[row['Room Name']] ?? row['Room Name']
    const roomId = roomIdByKey.get(`${mappedName}::${row['Building Name']}`)
    if (!roomId) { console.warn(`  ⚠ No room match: "${row['Room Name']}" @ "${row['Building Name']}"`); noRoomMatch++; continue }

    const start = toISO(row['Start At Tz'])
    const end   = toISO(row['End At Tz'])
    if (!start || !end) { badDates++; continue }

    if (!minStart || start < minStart) minStart = start
    if (!maxStart || start > maxStart) maxStart = start

    const csvCompanyName = row['Other Company Name']?.trim()
    let companyId = csvCompanyName ? companyIdByName.get(csvCompanyName.toLowerCase()) : null
    if (companyId) {
      matchedCompany++
    } else {
      fallbackCompany++
      if (!fallbackCoId) {
        if (DRY_RUN) {
          fallbackCoId = 'dry-fallback-co'
        } else {
          const { data: created, error } = await db.from('companies').insert({ name: FALLBACK_CO_NAME, monthly_hours_allotment: 0 }).select('id').single()
          if (error) { console.error('❌  Failed to create fallback company:', error.message); process.exit(1) }
          fallbackCoId = created.id
          companyIdByName.set(FALLBACK_CO_NAME.toLowerCase(), fallbackCoId)
        }
      }
      companyId = fallbackCoId
    }

    const ownerEmail = row['Owner Email']?.trim().toLowerCase()
    const knownMember = ownerEmail ? permittedByEmail.get(ownerEmail) : null
    const realAuthId  = ownerEmail ? authIdByEmail.get(ownerEmail) : null
    const realProfile = realAuthId ? profileById.get(realAuthId) : null
    let userId = placeholder.id
    let historicalEmail = null

    if (realProfile) {
      userId = realProfile.id
      companyId = realProfile.company_id ?? companyId
      linkedActive++
    } else if (knownMember) {
      historicalEmail = ownerEmail
      linkedPending++
    } else {
      linkedNone++
    }

    toInsert.push({
      room_id:    roomId,
      user_id:    userId,
      company_id: companyId,
      title:      row['Name']?.trim() || csvCompanyName || 'Reservation',
      start_time: start,
      end_time:   end,
      historical_email: historicalEmail,
    })
  }

  console.log(`Mapped and ready to insert: ${toInsert.length}`)
  console.log(`  matched to a real company: ${matchedCompany}`)
  console.log(`  fell back to "${FALLBACK_CO_NAME}": ${fallbackCompany}`)
  console.log(`  linked to an already-signed-up member: ${linkedActive}`)
  console.log(`  tagged for a pending member (will link at signup): ${linkedPending}`)
  console.log(`  no member match at all: ${linkedNone}`)
  console.log(`No room match (skipped): ${noRoomMatch}`)
  console.log(`Bad/missing dates (skipped): ${badDates}`)
  console.log(`Date range in CSV: ${minStart} to ${maxStart}\n`)

  if (DRY_RUN) {
    console.log('Sample of first 5:')
    toInsert.slice(0, 5).forEach(r => console.log(' ', r))
    console.log('\n✅  Dry run complete — re-run without --dry-run to write these.\n')
    return
  }

  if (!minStart || !maxStart) { console.error('❌  Could not determine a date range from the CSV — aborting.'); process.exit(1) }

  // Clear existing reservations in this exact range, then insert fresh
  // (full replace of the range, not an append).
  const clearStart = minStart.slice(0, 10) + 'T00:00:00Z'
  const clearEndDate = new Date(maxStart)
  clearEndDate.setUTCDate(clearEndDate.getUTCDate() + 1)
  const clearEnd = clearEndDate.toISOString().slice(0, 10) + 'T00:00:00Z'

  const { error: delErr } = await db.from('reservations')
    .delete()
    .gte('start_time', clearStart)
    .lt('start_time', clearEnd)
  if (delErr) { console.error('❌  Failed to clear existing reservations in range:', delErr.message); process.exit(1) }

  let inserted = 0, failed = 0
  const BATCH = 50
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await db.from('reservations').insert(batch)
    if (error) {
      console.error(`  ✗ batch ${i}-${i + batch.length}: ${error.message}`)
      failed += batch.length
    } else {
      inserted += batch.length
    }
  }

  console.log(`Inserted: ${inserted}  |  Failed: ${failed}\n`)
  console.log('✅  Done! View it on the Calendar / Reports pages.\n')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
