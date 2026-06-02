import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { location_id, name, capacity } = await request.json()
  if (!location_id || !name || !capacity) {
    return NextResponse.json({ error: 'location_id, name, and capacity are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Assign sort_order as next in sequence for this location
  const { data: existing } = await admin
    .from('rooms')
    .select('sort_order')
    .eq('location_id', location_id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const sort_order = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1

  const { data, error } = await admin
    .from('rooms')
    .insert({ location_id, name: name.trim(), capacity: parseInt(capacity), sort_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
