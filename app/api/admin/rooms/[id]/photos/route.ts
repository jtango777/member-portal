import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROOM_PHOTO_BUCKET, ROOM_PHOTO_MAX_BYTES, ROOM_PHOTO_TYPES } from '@/lib/roomPhotos'

// Adds a photo to a conference room's booking page (Joe, 2026-10-26). The
// browser shrinks it before sending, so what arrives here is web-sized. The
// new photo goes on the end of the room's list; the admin page sets the
// cover and removes photos through PATCH /api/admin/rooms/[id].

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { id } = await params

  const file = (await request.formData()).get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo was sent.' }, { status: 400 })
  if (!ROOM_PHOTO_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Photos must be JPG, PNG or WebP.' }, { status: 400 })
  }
  if (file.size > ROOM_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: 'That photo is too large (8 MB at most).' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: room } = await admin.from('rooms').select('id, photo_urls').eq('id', id).maybeSingle()
  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  // A fresh name per upload, so a replaced photo never lingers in a cache.
  const path = `${id}/${Date.now()}.${EXT[file.type]}`
  const { error: uploadErr } = await admin.storage
    .from(ROOM_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (uploadErr) {
    console.error('[admin/rooms/photos] Upload failed:', uploadErr.message)
    return NextResponse.json({ error: 'Could not upload that photo. Please try again.' }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from(ROOM_PHOTO_BUCKET).getPublicUrl(path)
  const photo_urls = [...(room.photo_urls ?? []), publicUrl]
  const { error } = await admin.from('rooms').update({ photo_urls }).eq('id', id)
  if (error) {
    console.error('[admin/rooms/photos] Save failed:', error.message)
    await admin.storage.from(ROOM_PHOTO_BUCKET).remove([path])
    return NextResponse.json({ error: 'Could not save that photo. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ photo_urls })
}
