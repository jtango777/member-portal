import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROOM_PHOTO_BUCKET, isAllowedRoomPhoto, uploadedPhotoPath } from '@/lib/roomPhotos'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  // Return upcoming reservation count so the UI can warn before deleting
  const { count } = await admin
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', id)
    .gte('start_time', new Date().toISOString())

  return NextResponse.json({ upcoming_reservations: count ?? 0 })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('rooms').delete().eq('id', id)
  if (error) {
    console.error('[admin/rooms] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to delete room.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const body = await request.json()
  const { name, capacity, external_bookable, internal_bookable, external_name, price_per_hour, description, features, photo_urls } = body

  const admin = createAdminClient()
  const update: Record<string, unknown> = {}

  // Photos are added by POST .../photos; this takes the list back reordered
  // (cover first) or with some removed. Removed uploads are deleted from
  // storage once the room no longer points at them.
  let removedUploads: string[] = []
  if (photo_urls !== undefined) {
    if (!Array.isArray(photo_urls) || !photo_urls.every(isAllowedRoomPhoto)) {
      return NextResponse.json({ error: 'Those photos are not valid.' }, { status: 400 })
    }
    const { data: current } = await admin.from('rooms').select('photo_urls').eq('id', id).maybeSingle()
    removedUploads = (current?.photo_urls ?? [])
      .filter((u: string) => !photo_urls.includes(u))
      .map(uploadedPhotoPath)
      .filter((p: string | null): p is string => !!p)
    update.photo_urls = photo_urls
  }

  if (name          !== undefined) update.name           = name?.trim()
  if (capacity      !== undefined) update.capacity        = parseInt(capacity)
  if (external_bookable !== undefined) update.external_bookable = external_bookable
  if (internal_bookable !== undefined) update.internal_bookable = internal_bookable
  if (external_name !== undefined) update.external_name  = external_name?.trim() || null
  if (price_per_hour !== undefined) update.price_per_hour = parseFloat(price_per_hour)
  if (description   !== undefined) update.description    = description?.trim() || null
  if (features      !== undefined) update.features       = features

  const { data, error } = await admin
    .from('rooms')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[admin/rooms] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update room.' }, { status: 500 })
  }
  if (removedUploads.length) {
    const { error: rmErr } = await admin.storage.from(ROOM_PHOTO_BUCKET).remove(removedUploads)
    if (rmErr) console.error('[admin/rooms] Could not delete removed photos:', rmErr.message)
  }
  return NextResponse.json(data)
}
