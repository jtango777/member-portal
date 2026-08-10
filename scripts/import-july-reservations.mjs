#!/usr/bin/env node
/**
 * BizHaus — Load historical July 2026 reservation data for preview
 *
 * Reads the Nexudus/getaroom July 2026 reservation export and loads it into
 * the `reservations` table so it's visible in the portal's calendar/reports.
 * Since the real historical bookers don't have portal accounts, every row is
 * attributed to a neutral "Historical Booking" placeholder account (not a
 * real staff member), with the actual company matched against the existing
 * Companies table wherever possible (falling back to a generic "External
 * Booking (Legacy)" company otherwise) — so the calendar shows real company
 * names instead of implying one person made every booking.
 *
 * Clears existing July 2026 reservations first, then re-inserts fresh from
 * the CSV — this is a full replace, not an append.
 *
 * Usage:
 *   node scripts/import-july-reservations.mjs --dry-run
 *   node scripts/import-july-reservations.mjs
 *   node scripts/import-july-reservations.mjs /path/to/reservations.csv
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
  // These already match exactly:
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
  const csvFile = resolve(positional[0] ?? '/Users/carolinesmith/Desktop/Reservations - July 2026 (3).csv')
  if (!existsSync(csvFile)) { console.error(`❌  CSV not found at: ${csvFile}`); process.exit(1) }

  console.log(`\n📅  Load July 2026 reservations for preview${DRY_RUN ? '  [DRY RUN — nothing will be written]' : ''}`)
  console.log(`    CSV: ${csvFile}\n`)

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: rooms } = await db.from('rooms').select('id, name, locations(name)')
  const roomIdByKey = new Map(rooms.map(r => [`${r.name}::${r.locations.name}`, r.id]))

  // Placeholder account for historical bookings — not a real staff member,
  // so the calendar doesn't imply anyone personally made all these bookings.
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

  // Match each booking's real company against existing companies; fall back
  // to a single generic "External Booking (Legacy)" company otherwise —
  // never BizHaus, since these aren't BizHaus's own bookings.
  const { data: companies } = await db.from('companies').select('id, name')
  const companyIdByName = new Map(companies.map(c => [c.name.toLowerCase(), c.id]))
  const FALLBACK_CO_NAME = 'External Booking (Legacy)'
  let fallbackCoId = companyIdByName.get(FALLBACK_CO_NAME.toLowerCase())

  const rows = parseCSV(csvFile)
  console.log(`CSV rows: ${rows.length}\n`)

  const toInsert = []
  let noRoomMatch = 0, badDates = 0, matchedCompany = 0, fallbackCompany = 0

  for (const row of rows) {
    const mappedName = ROOM_NAME_MAP[row['Room Name']] ?? row['Room Name']
    const roomId = roomIdByKey.get(`${mappedName}::${row['Building Name']}`)
    if (!roomId) { console.warn(`  ⚠ No room match: "${row['Room Name']}" @ "${row['Building Name']}"`); noRoomMatch++; continue }

    const start = toISO(row['Start At Tz'])
    const end   = toISO(row['End At Tz'])
    if (!start || !end) { badDates++; continue }

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

    toInsert.push({
      room_id:    roomId,
      user_id:    placeholder.id,
      company_id: companyId,
      title:      row['Name']?.trim() || csvCompanyName || 'Reservation',
      start_time: start,
      end_time:   end,
    })
  }

  console.log(`Mapped and ready to insert: ${toInsert.length}`)
  console.log(`  matched to a real company: ${matchedCompany}`)
  console.log(`  fell back to "${FALLBACK_CO_NAME}": ${fallbackCompany}`)
  console.log(`No room match (skipped): ${noRoomMatch}`)
  console.log(`Bad/missing dates (skipped): ${badDates}\n`)

  if (DRY_RUN) {
    console.log('Sample of first 5:')
    toInsert.slice(0, 5).forEach(r => console.log(' ', r))
    console.log('\n✅  Dry run complete — re-run without --dry-run to write these.\n')
    return
  }

  // Clear existing July 2026 reservations, then insert fresh (full replace, not append)
  const { error: delErr } = await db.from('reservations')
    .delete()
    .gte('start_time', '2026-07-01T00:00:00Z')
    .lt('start_time', '2026-08-01T00:00:00Z')
  if (delErr) { console.error('❌  Failed to clear existing July reservations:', delErr.message); process.exit(1) }

  // Insert in batches to avoid payload limits
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
