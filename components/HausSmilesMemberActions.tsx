'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = { id: string; source: 'profile' | 'directory' }

export default function HausSmilesMemberActions({ id, source }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

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
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-sm text-amber-700">Archive from Faces?</span>
        <button onClick={handleRemove} disabled={removing}
          className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium">
          {removing ? '…' : 'Yes, archive'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-sm text-gray-500">Cancel</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-700 mx-auto mt-4">
      <Trash2 size={14} /> Archive from Faces
    </button>
  )
}
