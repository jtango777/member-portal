'use client'

import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Upload, Crop, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImageBlob } from '@/lib/cropImage'
import { useNavBottom } from '@/lib/useNavBottom'
import { extractLinkedinUsername } from '@/lib/linkedin'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  title?: string
  description?: string
  currentImageUrl?: string | null
  // Only the first-time onboarding prompt sets this — offers LinkedIn
  // alongside the photo since it's the one moment every member is
  // guaranteed to see, without adding a LinkedIn field to every other
  // place this dialog gets reused (Settings already has its own).
  offerLinkedin?: boolean
}

export default function PhotoUploadDialog({
  open, onOpenChange, onSuccess,
  title = 'Add your photo to Faces',
  description = 'Help your community recognize you — add a profile picture.',
  currentImageUrl,
  offerLinkedin = false,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [linkedinUsername, setLinkedinUsername] = useState('')
  const [savingLinkedin, setSavingLinkedin] = useState(false)

  // Same paste-a-full-URL-or-just-type-a-username handling as the Settings
  // field — the "linkedin.com/in/" prefix is fixed and never editable.
  function handleLinkedinChange(raw: string) {
    if (raw.includes('linkedin.com') || raw.includes('://')) {
      setLinkedinUsername(extractLinkedinUsername(raw) ?? '')
      return
    }
    setLinkedinUsername(raw.replace(/[^a-zA-Z0-9-]/g, ''))
  }

  // Best-effort, like the avatar-prompt dismissal — if this fails, the
  // member can still set it later from Settings. Not worth blocking or
  // erroring the photo flow over.
  async function saveLinkedinIfNeeded() {
    if (!offerLinkedin || !linkedinUsername.trim()) return
    setSavingLinkedin(true)
    try {
      await fetch('/api/profile/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_username: linkedinUsername }),
      })
    } catch (_) {
      // best-effort, see above
    }
    setSavingLinkedin(false)
  }

  // Onboarding only: once the photo is saved, stay open on the LinkedIn
  // step instead of closing — closing right after the photo save used to
  // skip LinkedIn entirely for anyone who hadn't filled it in yet before
  // clicking Choose Photo.
  const [photoJustSaved, setPhotoJustSaved] = useState(false)
  // Local preview of the photo just uploaded. currentImageUrl is a prop
  // that only updates on router.refresh(), which is deferred until
  // Submit/Skip — so without this, the thumbnail kept showing the OLD
  // pre-linked photo after someone changed it. Caught 2026-09-10.
  const [savedPreviewUrl, setSavedPreviewUrl] = useState<string | null>(null)
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

  function resetAll() {
    reset()
    setPhotoJustSaved(false)
    if (savedPreviewUrl) URL.revokeObjectURL(savedPreviewUrl)
    setSavedPreviewUrl(null)
  }

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
      const formData = new FormData()
      formData.append('file', blob, 'avatar.jpg')
      const [res] = await Promise.all([
        fetch('/api/profile/avatar', { method: 'POST', body: formData }),
        saveLinkedinIfNeeded(),
      ])
      if (res.ok) {
        toast.success('Photo saved!')
        // The cropped blob is exactly what was uploaded, so it's an
        // accurate preview — no dependency on the API response shape.
        if (savedPreviewUrl) URL.revokeObjectURL(savedPreviewUrl)
        setSavedPreviewUrl(URL.createObjectURL(blob))
        reset()
        // Onboarding: stay open so they can still add LinkedIn and hit
        // Submit. Calling onSuccess() here used to be the bug — it's
        // router.refresh() one level up (OnboardingOverlays), which used
        // to re-fetch a server-rendered "has a photo" prop that controlled
        // whether this dialog was even open; once that flipped true, the
        // PARENT would set this dialog's open prop to false itself,
        // closing it from the outside no matter what local state said.
        // That prop is gone now (this prompt shows regardless of whether
        // someone already has a photo), but still deferring onSuccess() to
        // Submit/Skip below — the "done" signal should mean the LinkedIn
        // step is actually finished, not just that a photo exists.
        // Everywhere else this dialog is used, saving the photo is the
        // whole point of opening it, so call it immediately like before.
        if (offerLinkedin) setPhotoJustSaved(true)
        else { onSuccess(); onOpenChange(false) }
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
    <Dialog.Root open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetAll() }}>
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
          ) : offerLinkedin ? (
            // Onboarding layout: Choose Photo stands on its own up top —
            // saving it used to close the whole dialog immediately,
            // skipping LinkedIn for anyone who hadn't filled it in yet.
            // Now it just flips this to a green confirmation and stays
            // open on the LinkedIn step. The bottom row is for someone
            // who's done here: Submit saves whatever they typed (LinkedIn)
            // and closes; Skip closes without saving anything more.
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePickFile} className="hidden" />
              {(savedPreviewUrl ?? currentImageUrl) ? (
                // There's a photo to show — either one already on file
                // (pre-linked from the directory import) or the one they
                // just uploaded. savedPreviewUrl wins so the thumbnail
                // reflects the change immediately, not the stale prop.
                <div className="flex flex-col items-center gap-2">
                  {photoJustSaved && (
                    <div className="w-full flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-3 py-2 rounded-lg">
                      <Check size={16} /> Photo saved!
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={savedPreviewUrl ?? currentImageUrl ?? undefined} alt="Your photo"
                    className="w-24 h-24 rounded-full object-cover border border-gray-200" />
                  <button onClick={() => fileRef.current?.click()}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Change Photo
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  <Upload size={16} /> Choose Photo
                </button>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Add LinkedIn info (optional)</label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="pl-3 pr-1 py-2 text-sm text-gray-400 bg-gray-50 select-none whitespace-nowrap">linkedin.com/in/</span>
                  <input value={linkedinUsername} onChange={e => handleLinkedinChange(e.target.value)}
                    placeholder="janesmith"
                    className="w-full min-w-0 px-1 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onSuccess(); onOpenChange(false) }}
                  className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                  Skip for now
                </button>
                <button
                  onClick={async () => { await saveLinkedinIfNeeded(); toast.success('Saved!'); onSuccess(); onOpenChange(false) }}
                  disabled={savingLinkedin}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  {savingLinkedin ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
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
