import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  // Build update object from whatever fields were sent
  const update: Record<string, unknown> = {}
  if ('name'                   in body) update.name                   = body.name
  if ('monthly_hours_allotment' in body) update.monthly_hours_allotment = body.monthly_hours_allotment
  if ('is_active'               in body) update.is_active               = body.is_active
  if ('location_id'             in body) update.location_id             = body.location_id || null
  if ('grants_admin'            in body) update.grants_admin            = !!body.grants_admin

  const { data, error } = await admin
    .from('companies')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[admin/companies] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update company.' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// Remove company — flags it inactive rather than deleting the row, so
// existing reservations/feedback/usage history that points at it via
// company_id stays intact, and it can be restored later from the
// Inactive Companies list. Members keep their company_id (and hour
// pool) as-is; nothing about them changes just because the company
// itself is hidden from the active list.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('companies').update({ is_active: false }).eq('id', id)
  if (error) {
    console.error('[admin/companies] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to remove company.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
