import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { clearSettingsCache } from '@/lib/settings'

// The day pass price, editable from /dashboard/admin/day-passes instead of
// living in the code (Caroline, 2026-09-25).

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: setting }, { data: closures }] = await Promise.all([
    admin.from('app_settings').select('value, updated_at').eq('key', 'day_pass_price_cents').maybeSingle(),
    admin.from('closure_days').select('date, name, blocks_day_pass, blocks_rooms').order('date'),
  ])

  return NextResponse.json({
    priceCents: Number(setting?.value) || 0,
    priceUpdatedAt: setting?.updated_at ?? null,
    closures: closures ?? [],
  })
}

export async function PATCH(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { price_cents } = await request.json()
  const cents = Math.round(Number(price_cents))

  // A typo here charges every customer the wrong amount, so the bounds are
  // deliberately tight: between $1 and $500 a day.
  if (!Number.isFinite(cents) || cents < 100 || cents > 50_000) {
    return NextResponse.json({ error: 'Enter a price between $1 and $500.' }, { status: 400 })
  }

  const { error } = await createAdminClient()
    .from('app_settings')
    .update({ value: cents, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('key', 'day_pass_price_cents')

  if (error) {
    console.error('[admin/day-pass-settings] Price update failed:', error.message)
    return NextResponse.json({ error: 'Could not save the price. Please try again.' }, { status: 500 })
  }

  // Existing checkouts re-read the price when they take payment, so the new
  // one applies immediately rather than after the cache expires.
  clearSettingsCache()
  return NextResponse.json({ ok: true, priceCents: cents })
}
