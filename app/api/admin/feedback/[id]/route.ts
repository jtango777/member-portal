import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { resolved } = await request.json()

  const { error } = await supabase.from('feedback').update({ resolved: !!resolved }).eq('id', id)
  if (error) {
    console.error('[admin/feedback] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update feedback.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
