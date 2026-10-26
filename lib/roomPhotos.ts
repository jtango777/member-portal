// Conference room photos for the booking pages (migration 062). Each room
// holds an ordered list of URLs, first is the cover. A URL is either one of
// the original files shipped in public/rooms, or an upload in the public
// room-photos bucket.

export const ROOM_PHOTO_BUCKET = 'room-photos'
export const ROOM_PHOTO_MAX_BYTES = 8 * 1024 * 1024
export const ROOM_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const ORIGINAL_FILE = /^\/rooms\/[a-z0-9-]+\.(jpe?g|png|webp)$/

function bucketPrefix() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${ROOM_PHOTO_BUCKET}/`
}

// The storage path of an uploaded photo, or null for anything else
// (including the original files, which are not in the bucket).
export function uploadedPhotoPath(url: string): string | null {
  const prefix = bucketPrefix()
  if (!url.startsWith(prefix)) return null
  const path = url.slice(prefix.length).split('?')[0]
  return /^[0-9a-f-]{36}\/[\w.-]+$/.test(path) ? path : null
}

// Only URLs this app put there may be saved on a room, so the booking page
// never shows an image from somewhere else.
export function isAllowedRoomPhoto(url: unknown): url is string {
  return typeof url === 'string' && (ORIGINAL_FILE.test(url) || uploadedPhotoPath(url) !== null)
}
