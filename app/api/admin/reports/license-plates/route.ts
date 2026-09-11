import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Not month-scoped like the other reports — this is a current snapshot of
// members and whatever license plate they have on file (self-serve, set
// on their own Settings page), not a time-series of activity.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('full_name, license_plate, companies(name)')
    .eq('is_active', true)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
