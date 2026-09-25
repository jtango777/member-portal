import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { clearSettingsCache } from '@/lib/settings'

// Days BizHaus is closed. One list shared by day passes and conference room
// bookings, each day saying which of the two it blocks (Caroline,
// 2026-09-25). Edited from /dashboard/admin/day-passes.

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { date, name, blocks_day_pass = true, blocks_rooms = true } = await request.json()

  if (!isDate(date)) return NextResponse.json({ error: 'Pick a date.' }, { status: 400 })
  if (!name?.trim())  return NextResponse.json({ error: 'Give the day a name, e.g. "Staff offsite".' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('closure_days').insert({
    date,
    name: name.trim(),
    blocks_day_pass: !!blocks_day_pass,
    blocks_rooms: !!blocks_rooms,
  })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That date is already on the list.' }, { status: 409 })
    console.error('[admin/closures] Insert failed:', error.message)
    return NextResponse.json({ error: 'Could not add that day. Please try again.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { date, blocks_day_pass, blocks_rooms, name } = await request.json()
  if (!isDate(date)) return NextResponse.json({ error: 'Pick a date.' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof blocks_day_pass === 'boolean') patch.blocks_day_pass = blocks_day_pass
  if (typeof blocks_rooms === 'boolean')    patch.blocks_rooms    = blocks_rooms
  if (typeof name === 'string' && name.trim()) patch.name = name.trim()
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { error } = await createAdminClient().from('closure_days').update(patch).eq('date', date)
  if (error) {
    console.error('[admin/closures] Update failed:', error.message)
    return NextResponse.json({ error: 'Could not save that change. Please try again.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const date = new URL(request.url).searchParams.get('date')
  if (!isDate(date)) return NextResponse.json({ error: 'Pick a date.' }, { status: 400 })

  const { error } = await createAdminClient().from('closure_days').delete().eq('date', date)
  if (error) {
    console.error('[admin/closures] Delete failed:', error.message)
    return NextResponse.json({ error: 'Could not remove that day. Please try again.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true })
}
