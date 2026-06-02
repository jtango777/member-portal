import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM

  if (!month) return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })

  const start = new Date(`${month}-01T00:00:00`)
  const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reservations')
    .select(`
      id, title, notes, start_time, end_time,
      profiles ( full_name ),
      companies ( name ),
      rooms ( name, locations ( name ) )
    `)
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
