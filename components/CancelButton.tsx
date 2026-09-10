'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

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

  // Real width accordion (max-width, not grid-template-columns — Safari
  // doesn't reliably animate grid track sizing, it just snaps to the final
  // width instead of growing/shrinking) so trigger <-> confirm actually
  // animates instead of popping instantly, matching the same fix applied
  // to the cancel/delete buttons in ReservationModal's footer.
  return (
    <div className="flex items-center justify-end">
      <div className={cn('overflow-hidden transition-[max-width] duration-200 ease-out',
        confirming ? 'max-w-0' : 'max-w-[50px]')}>
        <button onClick={() => setConfirming(true)}
          className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap pr-2">
          Cancel
        </button>
      </div>
      <div className={cn('overflow-hidden transition-[max-width] duration-200 ease-out',
        confirming ? 'max-w-[150px]' : 'max-w-0')}>
        <div className="flex items-center gap-1.5 whitespace-nowrap pr-2">
          <span className="text-xs text-red-600">Cancel?</span>
          <button onClick={handleCancel} disabled={loading}
            className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
            {loading ? '…' : 'Yes'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-gray-400">No</button>
        </div>
      </div>
    </div>
  )
}
