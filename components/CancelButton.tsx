'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

export default function CancelButton({ reservationId }: { reservationId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)

  async function handleCancel() {
    setLoading(true)
    const res = await fetch(`/api/reservations/${reservationId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Reservation cancelled')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Could not cancel')
      setLoading(false)
      setConfirming(false)
    }
  }

  // Trashcan icon, matching the pencil edit icon next to it — instant
  // swap to a small text confirm, no width animation (tried an animated
  // accordion here twice and it kept coming out jumpy no matter how it
  // was tuned, so this drops the animation entirely).
  if (confirming) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="text-sm text-red-600">Cancel?</span>
        <button onClick={handleCancel} disabled={loading}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-medium disabled:opacity-50">
          {loading ? '…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-sm text-gray-500 hover:text-gray-700">
          No
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} title="Cancel reservation"
      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
      <Trash2 size={14} />
    </button>
  )
}
