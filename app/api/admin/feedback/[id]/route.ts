import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const body = await request.json()
  const { resolved, notes, assigned_to } = body

  const update: Record<string, unknown> = {}
  if (resolved !== undefined)    update.resolved = !!resolved
  if (notes !== undefined)       update.notes = notes?.trim() || null
  if (assigned_to !== undefined) update.assigned_to = assigned_to || null

  const { error } = await supabase.from('feedback').update(update).eq('id', id)
  if (error) {
    console.error('[admin/feedback] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update feedback.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
