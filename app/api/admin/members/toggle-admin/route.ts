import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { user_id, is_admin } = await request.json()
  if (!user_id || typeof is_admin !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ is_admin }).eq('id', user_id)
  if (error) {
    console.error('[admin/toggle-admin] error:', error.message)
    return NextResponse.json({ error: 'Failed to update admin status.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
