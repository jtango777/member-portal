'use client'

import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Upload, Crop } from 'lucide-react'
import toast from 'react-hot-toast'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImageBlob } from '@/lib/cropImage'
import { useNavBottom } from '@/lib/useNavBottom'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  title?: string
  description?: string
  currentImageUrl?: string | null
}

export default function PhotoUploadDialog({
  open, onOpenChange, onSuccess,
  title = 'Add your photo to Faces',
  description = 'Help your community recognize you — add a profile picture.',
  currentImageUrl,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const navBottom = useNavBottom()

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  function reset() {
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
      const formData = new FormData()
      formData.append('file', blob, 'avatar.jpg')
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
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

  return (
    <Dialog.Root open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-x-0 bottom-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" style={{ top: navBottom }} />
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center pointer-events-none p-4" style={{ top: navBottom }}>
        <Dialog.Content className="pointer-events-auto bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold text-gray-900">{title}</Dialog.Title>
            {imageSrc && (
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            )}
          </div>
          <Dialog.Description className="text-sm text-gray-500 mb-4">{description}</Dialog.Description>

          {imageSrc ? (
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
                <button onClick={reset} disabled={uploading}
                  className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Choose Different Photo
                </button>
                <button onClick={handleConfirm} disabled={uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  {uploading ? 'Saving…' : 'Save Photo'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePickFile} className="hidden" />
              {currentImageUrl && (
                <button onClick={() => setImageSrc(currentImageUrl)}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-lg">
                  <Crop size={16} /> Recrop Current Photo
                </button>
              )}
              <div className="flex gap-2">
                <Dialog.Close className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                  Skip for now
                </Dialog.Close>
                <button onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  <Upload size={16} /> Choose Photo
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
