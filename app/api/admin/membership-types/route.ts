import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('membership_types').select('*').order('sort_order')
  if (error) return NextResponse.json({ error: 'Failed to load membership types.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, hours_per_month } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: top } = await admin
    .from('membership_types').select('sort_order').order('sort_order', { ascending: false }).limit(1).single()

  const { data, error } = await admin
    .from('membership_types')
    .insert({ name, hours_per_month: hours_per_month ?? null, sort_order: (top?.sort_order ?? 0) + 1 })
    .select().single()

  if (error) {
    console.error('[admin/membership-types] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to create membership type.' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
