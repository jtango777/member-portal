'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { IconAction } from '@/components/admin/AdminTable'

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

  // Same IconAction the admin tables use (grey by default, colorClass
  // supplies the hover color) so this matches the pencil next to it —
  // instant swap to a small text confirm, no width animation.
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
    <IconAction
      icon={Trash2}
      label="Cancel reservation"
      onClick={() => setConfirming(true)}
      colorClass="text-gray-400 hover:bg-red-50 hover:text-red-600"
    />
  )
}
