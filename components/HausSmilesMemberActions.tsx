'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import AssignPhotoDialog from './admin/AssignPhotoDialog'

type Props = { id: string; source: 'profile' | 'directory'; fullName: string; avatarUrl: string | null }

export default function HausSmilesMemberActions({ id, source, fullName, avatarUrl }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    const res = await fetch(`/api/admin/haus-smiles/${id}?source=${source}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Archived')
      router.push('/dashboard/haus-smiles')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to remove')
      setRemoving(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-center gap-1.5 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-amber-700">Archive from Faces?</span>
          <button onClick={handleRemove} disabled={removing}
            className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium">
            {removing ? '…' : 'Yes, archive'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-sm text-gray-500">Cancel</button>
        </div>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          This only removes the photo — it won't archive their membership or invite.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button onClick={() => setEditingPhoto(true)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-700">
        <Pencil size={14} /> Change photo
      </button>
      <button onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-700">
        <Trash2 size={14} /> Archive from Faces
      </button>

      {editingPhoto && (
        <AssignPhotoDialog
          open
          onOpenChange={v => setEditingPhoto(v)}
          onSuccess={() => { setEditingPhoto(false); router.refresh() }}
          targetType={source === 'profile' ? 'member' : 'directory'}
          targetId={id}
          memberName={fullName}
          hasPhoto
          avatarUrl={avatarUrl}
        />
      )}
    </div>
  )
}
