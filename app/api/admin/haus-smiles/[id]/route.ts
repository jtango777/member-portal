import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Remove a face from Faces. Directory-only photos are deleted outright
// (no account attached). Real member accounts are flagged inactive rather
// than deleted, consistent with how member removal works elsewhere.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  if (source === 'directory') {
    const { error } = await admin.from('directory_photos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to delete photo.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (source === 'profile') {
    const { error } = await admin.from('profiles').update({ is_active: false }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'source must be "profile" or "directory"' }, { status: 400 })
}
