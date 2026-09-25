import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { clearSettingsCache } from '@/lib/settings'

// Days BizHaus is closed. One table, but each product keeps its own list:
// day passes are managed on the Day Passes page and conference rooms on Room
// Settings, because the rooms can be rented on a day the coworking floor is
// shut (Caroline, 2026-09-25). A date that blocks both simply has both flags
// set, and appears on both pages.

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const columnFor = (product: unknown) =>
  product === 'rooms' ? 'blocks_rooms' : product === 'day_pass' ? 'blocks_day_pass' : null

export async function GET(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const column = columnFor(new URL(request.url).searchParams.get('product'))
  if (!column) return NextResponse.json({ error: 'Unknown product.' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('closure_days')
    .select('date, name, blocks_day_pass, blocks_rooms')
    .eq(column, true)
    .order('date')

  if (error) {
    console.error('[admin/closures] Read failed:', error.message)
    return NextResponse.json({ error: 'Could not load the closed days.' }, { status: 500 })
  }
  return NextResponse.json({ closures: data ?? [] })
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { date, name, product } = await request.json()
  const column = columnFor(product)
  if (!column)      return NextResponse.json({ error: 'Unknown product.' }, { status: 400 })
  if (!isDate(date)) return NextResponse.json({ error: 'Pick a date.' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Give the day a name, e.g. "Staff offsite".' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('closure_days').select('date, blocks_day_pass, blocks_rooms').eq('date', date).maybeSingle()

  // Already closed for the other product? Turn this one on rather than
  // refusing, so the two lists never fight over the same date.
  const { error } = existing
    ? await admin.from('closure_days').update({ [column]: true, name: name.trim() }).eq('date', date)
    : await admin.from('closure_days').insert({
        date,
        name: name.trim(),
        blocks_day_pass: column === 'blocks_day_pass',
        blocks_rooms:    column === 'blocks_rooms',
      })

  if (error) {
    console.error('[admin/closures] Save failed:', error.message)
    return NextResponse.json({ error: 'Could not add that day. Please try again.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const params  = new URL(request.url).searchParams
  const date    = params.get('date')
  const column  = columnFor(params.get('product'))
  if (!column)      return NextResponse.json({ error: 'Unknown product.' }, { status: 400 })
  if (!isDate(date)) return NextResponse.json({ error: 'Pick a date.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin.from('closure_days').select('blocks_day_pass, blocks_rooms').eq('date', date).maybeSingle()
  if (!row) return NextResponse.json({ ok: true })

  const other = column === 'blocks_day_pass' ? row.blocks_rooms : row.blocks_day_pass

  // Still closed for the other product, so keep the row and just drop this
  // one. Closed for neither any more, so the row goes.
  const { error } = other
    ? await admin.from('closure_days').update({ [column]: false }).eq('date', date)
    : await admin.from('closure_days').delete().eq('date', date)

  if (error) {
    console.error('[admin/closures] Remove failed:', error.message)
    return NextResponse.json({ error: 'Could not remove that day. Please try again.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true, stillClosedForOther: !!other })
}
