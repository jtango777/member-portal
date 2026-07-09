'use client'

import { useRef, useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Upload, Images, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImageBlob } from '@/lib/cropImage'
import { createClient } from '@/lib/supabase/client'

type DirectoryPhoto = { id: string; full_name: string; avatar_url: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  targetType: 'member' | 'pending'
  targetId: string
  memberName: string
}

type Mode = 'choose' | 'upload' | 'directory'

export default function AssignPhotoDialog({ open, onOpenChange, onSuccess, targetType, targetId, memberName }: Props) {
  const endpoint = targetType === 'member'
    ? `/api/admin/members/${targetId}/photo`
    : `/api/admin/pending-members/${targetId}/photo`
  const [mode, setMode] = useState<Mode>('choose')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const [photos, setPhotos] = useState<DirectoryPhoto[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [search, setSearch] = useState('')
  const [linking, setLinking] = useState<string | null>(null)

  function reset() {
    setMode('choose')
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setSearch('')
  }

  useEffect(() => {
    if (mode !== 'directory' || photos.length > 0) return
    setLoadingPhotos(true)
    const supabase = createClient()
    supabase.from('directory_photos').select('id, full_name, avatar_url').order('full_name')
      .then(({ data }) => {
        setPhotos(data ?? [])
        setLoadingPhotos(false)
      })
  }, [mode, photos.length])

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  async function handleUploadConfirm() {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
      const formData = new FormData()
      formData.append('file', blob, 'avatar.jpg')
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('Photo saved!')
        onOpenChange(false)
        reset()
        onSuccess()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Upload failed')
      }
    } catch {
      toast.error('Could not process image')
    }
    setUploading(false)
  }

  async function handleLinkPhoto(photo: DirectoryPhoto) {
    setLinking(photo.id)
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory_photo_id: photo.id }),
    })
    if (res.ok) {
      toast.success('Photo linked!')
      onOpenChange(false)
      reset()
      onSuccess()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to link photo')
    }
    setLinking(null)
  }

  const filteredPhotos = photos.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog.Root open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {mode !== 'choose' && (
                  <button onClick={() => { setMode('choose'); setImageSrc(null) }} className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <Dialog.Title className="text-sm font-semibold text-gray-900">Add photo for {memberName}</Dialog.Title>
              </div>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>

            {mode === 'choose' && (
              <div className="space-y-2">
                <button onClick={() => setMode('upload')}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-3 rounded-lg">
                  <Upload size={16} /> Upload from Computer
                </button>
                <button onClick={() => setMode('directory')}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-3 rounded-lg">
                  <Images size={16} /> Choose from Directory
                </button>
              </div>
            )}

            {mode === 'upload' && (
              imageSrc ? (
                <div className="space-y-4">
                  <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="round"
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    />
                  </div>
                  <input type="range" min={1} max={3} step={0.01} value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    className="w-full" />
                  <div className="flex gap-2">
                    <button onClick={() => setImageSrc(null)} disabled={uploading}
                      className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      Choose Different Photo
                    </button>
                    <button onClick={handleUploadConfirm} disabled={uploading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                      {uploading ? 'Saving…' : 'Save Photo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePickFile} className="hidden" />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    <Upload size={16} /> Choose Photo
                  </button>
                </div>
              )
            )}

            {mode === 'directory' && (
              <div className="space-y-3">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {loadingPhotos ? (
                  <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
                ) : filteredPhotos.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No matching photos.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                    {filteredPhotos.map(photo => (
                      <button key={photo.id} onClick={() => handleLinkPhoto(photo)} disabled={linking === photo.id}
                        className="text-center group disabled:opacity-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.avatar_url} alt={photo.full_name}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-200 mb-1 group-hover:opacity-75 transition-opacity" />
                        <p className="text-xs text-gray-600 truncate">{linking === photo.id ? 'Linking…' : photo.full_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
