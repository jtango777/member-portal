import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: locations } = await admin
    .from('locations')
    .select('id, name')
    .order('name')

  const { data: tokens } = await admin
    .from('qb_tokens')
    .select('location_id, realm_id, needs_reconnect, expires_at')

  const tokenMap = new Map((tokens ?? []).map(t => [t.location_id, t]))

  const statuses = (locations ?? []).map(loc => {
    const token = tokenMap.get(loc.id)
    return {
      location_id: loc.id,
      location_name: loc.name,
      connected: !!token,
      needs_reconnect: token?.needs_reconnect ?? false,
      realm_id: token?.realm_id ?? null,
    }
  })

  return NextResponse.json(statuses)
}
