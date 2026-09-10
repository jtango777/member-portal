'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { IconAction } from '@/components/admin/AdminTable'

// Cancels immediately on click, no confirm step — tried a confirm dialog
// here (matching Members' Archive flow) and an inline row confirm before
// that, but the extra step wasn't wanted; pressing Cancel just cancels it.
export default function CancelButton({ reservationId }: { reservationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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
    }
  }

  return (
    <IconAction
      icon={Trash2}
      label="Cancel reservation"
      onClick={handleCancel}
      disabled={loading}
      colorClass="text-gray-400 hover:bg-red-50 hover:text-red-600"
    />
  )
}
