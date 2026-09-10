'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import AssignPhotoDialog from './admin/AssignPhotoDialog'

type Props = { id: string; source: 'profile' | 'pending' | 'directory'; fullName: string; avatarUrl: string | null }

export default function HausSmilesMemberActions({ id, source, fullName, avatarUrl }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    const res = await fetch(`/api/admin/faces/${id}?source=${source}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Archived')
      router.push('/dashboard/faces')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to remove')
      setRemoving(false)
      setConfirming(false)
    }
  }

  // Matches the real behavior of DELETE /api/admin/faces/[id] per source —
  // see that route for the full reasoning. Rebuilt 2026-09-10 alongside the
  // Faces grid's version of this same copy; this page had drifted to a
  // stale claim ("only removes the photo... use the Members page") that
  // was never true for pending invites and, worse, wasn't even a complete
  // picture for real accounts (archiving never blocked login for anyone).
  const confirmCopy =
    source === 'directory'
      ? { question: 'Archive photo only?', detail: 'No account exists to archive — just removes this photo.' }
      : source === 'pending'
      ? { question: `Archive ${fullName.split(' ')[0]}'s invite?`, detail: 'Removes them from Members & Pipedrive — their invite link stops working.' }
      : { question: `Archive ${fullName.split(' ')[0]}'s account?`, detail: 'Blocks their login and removes them from Members, Faces, reports & Pipedrive.' }

  if (confirming) {
    return (
      <div className="flex flex-col items-center gap-1.5 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-red-700">{confirmCopy.question}</span>
          <button onClick={handleRemove} disabled={removing}
            className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium">
            {removing ? '…' : 'Yes, archive'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-sm text-gray-500">Cancel</button>
        </div>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          {confirmCopy.detail}
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
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-700">
        <Trash2 size={14} /> Archive from Faces
      </button>

      {editingPhoto && (
        <AssignPhotoDialog
          open
          onOpenChange={v => setEditingPhoto(v)}
          onSuccess={() => { setEditingPhoto(false); router.refresh() }}
          targetType={source === 'profile' ? 'member' : source === 'pending' ? 'pending' : 'directory'}
          targetId={id}
          memberName={fullName}
          hasPhoto
          avatarUrl={avatarUrl}
        />
      )}
    </div>
  )
}
