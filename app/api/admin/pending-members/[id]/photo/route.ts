import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Upload a photo for a pending (not-yet-registered) invite
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { id } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `pending/${id}/avatar.${ext}`

  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${publicUrl}?v=${Date.now()}`

  const { error: inviteErr } = await admin.from('permitted_emails').update({ avatar_url: avatarUrl }).eq('id', id)
  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 })

  return NextResponse.json({ avatar_url: avatarUrl })
}

// Link an existing directory photo to a pending invite
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { id } = await params

  const { directory_photo_id } = await request.json()
  if (!directory_photo_id) return NextResponse.json({ error: 'directory_photo_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: photo, error: fetchErr } = await admin
    .from('directory_photos')
    .select('avatar_url')
    .eq('id', directory_photo_id)
    .single()

  if (fetchErr || !photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  const { error: inviteErr } = await admin.from('permitted_emails').update({ avatar_url: photo.avatar_url }).eq('id', id)
  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 })

  await admin.from('directory_photos').delete().eq('id', directory_photo_id)

  return NextResponse.json({ avatar_url: photo.avatar_url })
}
