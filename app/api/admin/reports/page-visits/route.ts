import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { data: visits, error } = await admin
    .from('page_visits')
    .select('id, user_id, path, started_at, duration_seconds')
    .order('started_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Failed to load visits.' }, { status: 500 })

  const userIds = [...new Set((visits ?? []).map(v => v.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, default_location_id')
    .in('id', userIds)
  const idToName = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]))
  const idToLocation = Object.fromEntries((profiles ?? []).map(p => [p.id, p.default_location_id]))

  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const idToEmail = Object.fromEntries((authUsers ?? []).map(u => [u.id, u.email]))

  const result = (visits ?? []).map(v => ({
    id: v.id,
    path: v.path,
    started_at: v.started_at,
    duration_seconds: v.duration_seconds,
    full_name: idToName[v.user_id] ?? null,
    email: idToEmail[v.user_id] ?? null,
    default_location_id: idToLocation[v.user_id] ?? null,
  }))

  return NextResponse.json(result)
}
