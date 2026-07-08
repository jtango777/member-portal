import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST (not PATCH) so this can be called via navigator.sendBeacon, which only supports POST
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { duration_seconds } = await request.json()
  if (typeof duration_seconds !== 'number') {
    return NextResponse.json({ error: 'duration_seconds required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('page_visits')
    .update({ duration_seconds })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to update visit.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
