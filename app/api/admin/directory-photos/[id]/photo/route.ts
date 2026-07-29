import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Replace the photo on a directory-only (no account) Faces entry
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { id } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `directory/${id}/avatar.${ext}`

  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${publicUrl}?v=${Date.now()}`

  const { error: photoErr } = await admin.from('directory_photos').update({ avatar_url: avatarUrl }).eq('id', id)
  if (photoErr) return NextResponse.json({ error: photoErr.message }, { status: 500 })

  return NextResponse.json({ avatar_url: avatarUrl })
}
