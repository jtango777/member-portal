'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

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

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-xs text-red-600">Cancel?</span>
        <button onClick={handleCancel} disabled={loading}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
          {loading ? '…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400">No</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-xs text-red-500 hover:text-red-700 font-medium">
      Cancel
    </button>
  )
}
