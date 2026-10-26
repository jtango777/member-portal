'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// The photos a conference room shows on the booking page, in order; the
// first is the cover (Joe, 2026-10-26). Changes save immediately, apart from
// the room's other details, which wait for Save.

// Phone photos run to several MB and 4000px; the booking card is a few
// hundred px wide. Shrunk in the browser before upload so the public page
// stays quick.
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

async function shrinkForWeb(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot prepare the photo.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', JPEG_QUALITY))
}

export default function RoomPhotosEditor({ roomId, roomLabel, photos, onChange }: {
  roomId: string
  roomLabel: string
  photos: string[]
  onChange: (photos: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)   // what is happening, for the button text

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please choose a photo.'); return }
    setBusy('Uploading…')
    try {
      const form = new FormData()
      form.append('file', new File([await shrinkForWeb(file)], 'photo.jpg', { type: 'image/jpeg' }))
      const res = await fetch(`/api/admin/rooms/${roomId}/photos`, { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Could not upload that photo.')
      onChange(json.photo_urls)
      toast.success(photos.length ? 'Photo added' : 'Photo added as the cover')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload that photo.')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save(next: string[], done: string) {
    setBusy('Saving…')
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_urls: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Could not update the photos.')
      onChange(json.photo_urls ?? next)
      toast.success(done)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the photos.')
    } finally {
      setBusy(null)
    }
  }

  const makeCover = (url: string) => save([url, ...photos.filter(u => u !== url)], 'Cover photo changed')
  const remove = (url: string, i: number) => {
    if (!confirm(`Remove ${i === 0 ? 'the cover photo' : 'this photo'} from ${roomLabel}?`)) return
    save(photos.filter(u => u !== url), 'Photo removed')
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Photos <span className="font-normal text-gray-400">(first is the cover; changes save straight away)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={url} className="group relative w-32 aspect-[16/10] rounded-md overflow-hidden ring-1 ring-gray-200 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${roomLabel} photo ${i + 1}`} className="w-full h-full object-cover object-[center_65%]" />
            {i === 0 && (
              <span className="absolute top-1 left-1 text-[10px] font-semibold bg-white/90 text-gray-800 px-1.5 py-0.5 rounded">Cover</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {i > 0 && (
                <button type="button" onClick={() => makeCover(url)} disabled={!!busy} title="Make this the cover"
                  className="p-1 rounded bg-white/90 text-gray-700 hover:bg-white disabled:opacity-50">
                  <Star size={12} />
                </button>
              )}
              <button type="button" onClick={() => remove(url, i)} disabled={!!busy} title="Remove this photo"
                className="p-1 rounded bg-white/90 text-red-600 hover:bg-white disabled:opacity-50">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
          className={cn('w-32 aspect-[16/10] rounded-md border-2 border-dashed border-gray-300 text-gray-500',
            'flex flex-col items-center justify-center gap-1 text-xs hover:border-blue-400 hover:text-blue-600 disabled:opacity-50')}>
          <ImagePlus size={18} />
          {busy ?? 'Add photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      </div>
      {photos.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">No photos yet; the booking page shows &ldquo;Photos coming soon&rdquo;.</p>
      )}
    </div>
  )
}
