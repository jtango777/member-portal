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
  if ('membership_type_id'     in body) update.membership_type_id     = body.membership_type_id ?? null

  const { data, error } = await admin
    .from('companies')
    .update(update)
    .eq('id', id)
    .select('*, membership_types(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
