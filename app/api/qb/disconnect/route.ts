import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { disconnectQuickBooks } from '@/lib/quickbooks'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { location_id } = await request.json()
  if (!location_id) return NextResponse.json({ error: 'Missing location_id' }, { status: 400 })

  try {
    await disconnectQuickBooks(location_id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[qb/disconnect] error:', err)
    return NextResponse.json({ error: 'Failed to disconnect QuickBooks.' }, { status: 500 })
  }
}
