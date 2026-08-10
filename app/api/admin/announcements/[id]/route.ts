import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Deactivate the current announcement — leaves nothing shown to members
// until an admin posts a new one, rather than falling back to whatever
// was posted before it.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin.from('announcements').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to deactivate announcement.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
