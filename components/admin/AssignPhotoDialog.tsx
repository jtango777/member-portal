'use client'

import { useRef, useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Upload, Images, ArrowLeft, Crop } from 'lucide-react'
import toast from 'react-hot-toast'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImageBlob } from '@/lib/cropImage'
import { createClient } from '@/lib/supabase/client'

type DirectoryPhoto = { id: string; full_name: string; avatar_url: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  targetType: 'member' | 'pending' | 'directory'
  targetId: string
  memberName: string
  hasPhoto?: boolean
  avatarUrl?: string | null
}

type Mode = 'choose' | 'upload' | 'directory'

export default function AssignPhotoDialog({ open, onOpenChange, onSuccess, targetType, targetId, memberName, hasPhoto, avatarUrl }: Props) {
  const endpoint = targetType === 'member'
    ? `/api/admin/members/${targetId}/photo`
    : targetType === 'directory'
    ? `/api/admin/directory-photos/${targetId}/photo`
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
  const [showPhotoPreview, setShowPhotoPreview] = useState(false)

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
    setMode('upload')
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
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePickFile} className="hidden" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {mode !== 'choose' && (
                  <button onClick={() => { setMode('choose'); setImageSrc(null) }} className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <Dialog.Title className="text-sm font-semibold text-gray-900">Photo for {memberName}</Dialog.Title>
              </div>
              {mode === 'choose' ? (
                <Dialog.Close className="text-sm text-gray-500 hover:text-gray-700 font-medium">Skip for now</Dialog.Close>
              ) : (
                <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
              )}
            </div>

            {mode === 'choose' && (
              <div className="space-y-3">
                {hasPhoto && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-800">
                    Photo already added for this user.
                    {avatarUrl && (
                      <button onClick={() => setShowPhotoPreview(true)}
                        className="block mt-1 text-green-700 underline hover:text-green-900 text-xs">
                        View current photo
                      </button>
                    )}
                  </div>
                )}

                {showPhotoPreview && avatarUrl && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
                    onClick={() => setShowPhotoPreview(false)}>
                    <div className="relative bg-white rounded-xl p-4 shadow-xl" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setShowPhotoPreview(false)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarUrl} alt={memberName}
                        className="w-40 h-40 rounded-full object-cover border border-gray-200" />
                    </div>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  {hasPhoto ? 'Adjust sizing, add a new photo, or link one from the directory?' : `Add a photo for ${memberName}`}
                </p>
                {hasPhoto && avatarUrl && (
                  <button onClick={() => { setImageSrc(avatarUrl); setCrop({ x: 0, y: 0 }); setZoom(1); setMode('upload') }}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-3 rounded-lg">
                    <Crop size={16} /> Adjust Sizing on Current Photo
                  </button>
                )}
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-3 rounded-lg">
                  <Upload size={16} /> Upload from Computer
                </button>
                {targetType !== 'directory' && (
                  <button onClick={() => setMode('directory')}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-3 rounded-lg">
                    <Images size={16} /> Choose from Directory
                  </button>
                )}
              </div>
            )}

            {mode === 'upload' && imageSrc && (
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
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Choose Different Photo
                  </button>
                  <button onClick={handleUploadConfirm} disabled={uploading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    {uploading ? 'Saving…' : 'Save Photo'}
                  </button>
                </div>
              </div>
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
