import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DESK_NAME_MAX, isDeskOnPlan } from '@/lib/deskPlans'

// Saves the name written against one seat on a Labs seating chart. Clearing
// a box frees the seat, so an empty name deletes the row rather than storing
// a blank. Every change also lands in desk_assignment_history by trigger
// (migration 061), kept for a "chart as of a date" view that may come back.

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function PUT(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { plan, desk, name: rawName } = await request.json()
  if (typeof plan !== 'string' || typeof desk !== 'string' || !isDeskOnPlan(plan, desk)) {
    return NextResponse.json({ error: 'Unknown seat.' }, { status: 400 })
  }
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (name.length > DESK_NAME_MAX) {
    return NextResponse.json({ error: `Names can be up to ${DESK_NAME_MAX} characters.` }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  let error
  if (name) {
    ;({ error } = await admin.from('desk_assignments').upsert({ plan, desk, name, updated_at: now, updated_by: user.id }))
  } else {
    // Stamp who is clearing it first, so the history row the delete writes
    // says who freed the seat. Same name, so the stamp itself records nothing.
    await admin.from('desk_assignments').update({ updated_at: now, updated_by: user.id }).eq('plan', plan).eq('desk', desk)
    ;({ error } = await admin.from('desk_assignments').delete().eq('plan', plan).eq('desk', desk))
  }

  if (error) {
    console.error('[admin/desk-assignments] Save failed:', error.message)
    return NextResponse.json({ error: 'Could not save that seat. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, name })
}
