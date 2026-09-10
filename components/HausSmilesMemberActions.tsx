'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import AssignPhotoDialog from './admin/AssignPhotoDialog'
import ArchiveFaceDialog from './ArchiveFaceDialog'

type Props = { id: string; source: 'profile' | 'pending' | 'directory'; fullName: string; avatarUrl: string | null }

export default function HausSmilesMemberActions({ id, source, fullName, avatarUrl }: Props) {
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState(false)

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button onClick={() => setEditingPhoto(true)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-700">
        <Pencil size={14} /> Change photo
      </button>
      <button onClick={() => setArchiving(true)}
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

      {/* Same modal as the Faces grid (components/ArchiveFaceDialog.tsx) —
          this page used to have its own smaller inline version of this
          confirmation with copy that drifted out of sync from the real
          behavior. Unified 2026-09-10. */}
      <ArchiveFaceDialog
        face={archiving ? { id, source, name: fullName.split(' ')[0] } : null}
        onOpenChange={v => setArchiving(v)}
        onSuccess={() => { setArchiving(false); router.push('/dashboard/faces'); router.refresh() }}
      />
    </div>
  )
}
