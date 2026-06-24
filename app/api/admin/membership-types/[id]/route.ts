import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, hours_per_month } = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('membership_types')
    .update({ name, hours_per_month: hours_per_month ?? null })
    .eq('id', id)
    .select().single()

  if (error) {
    console.error('[admin/membership-types] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update membership type.' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('membership_types').delete().eq('id', id)
  if (error) {
    console.error('[admin/membership-types] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to delete membership type.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
