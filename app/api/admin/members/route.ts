import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('permitted_emails')
    .select('*, companies(id, name)')
    .order('invited_at', { ascending: false })
  if (error) {
    console.error('[admin/members] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to load members.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
