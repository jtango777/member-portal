import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { announcement_id } = await request.json()
  if (!announcement_id) return NextResponse.json({ error: 'announcement_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ dismissed_announcement_id: announcement_id })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
