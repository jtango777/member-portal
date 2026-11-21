'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// Conference rooms only. Built to behave exactly like the day pass
// cancel button beside it, because they sit in the same list and
// anything that behaved differently would read as a bug
// (Caroline, 2026-11-20).
//
// The parent only renders this while the booking is still before its
// 9 PM-the-night-before cutoff; /api/book/cancel checks that again for
// real, since a page left open overnight would otherwise offer a button
// that cannot work.
//
// What comes back is credit, never a refund, so the confirm step says so
// plainly rather than promising money back.
export default function CancelRoomBookingButton({
  confirmationNumber, label = 'Cancel', className, wrapperClassName = 'h-8',
}: {
  confirmationNumber: string
  label?: string
  className?: string
  wrapperClassName?: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [width, setWidth] = useState<number | undefined>(undefined)

  const collapsedRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = confirming ? expandedRef.current : collapsedRef.current
    if (el) setWidth(el.scrollWidth)
  }, [confirming, loading])

  async function handleCancel() {
    setLoading(true)
    const res = await fetch('/api/book/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_number: confirmationNumber }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Cancelled. $${((data.creditedCents ?? 0) / 100).toFixed(2)} is held as credit — we've emailed you the details.`)
      router.refresh()
    } else {
      toast.error(data.error ?? 'Could not cancel this booking.')
    }
    setConfirming(false)
    setLoading(false)
  }

  return (
    <div
      className={cn('relative overflow-hidden transition-[width] duration-300 ease-in-out', wrapperClassName)}
      style={{ width }}
    >
      <div
        ref={collapsedRef}
        className={cn(
          'absolute inset-y-0 left-0 flex items-center whitespace-nowrap transition-opacity duration-200',
          confirming ? 'pointer-events-none opacity-0' : 'opacity-100 delay-100',
        )}
      >
        <button
          onClick={() => setConfirming(true)}
          className={cn(
            'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-600',
            'hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors',
            className,
          )}
        >
          {label}
        </button>
      </div>

      <div
        ref={expandedRef}
        className={cn(
          'absolute inset-y-0 left-0 flex items-center gap-2 whitespace-nowrap transition-opacity duration-200',
          confirming ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0',
        )}
      >
        <button
          onClick={handleCancel}
          disabled={loading}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Cancelling…' : 'Cancel for credit?'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-[13px] font-medium text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
        >
          Keep it
        </button>
      </div>
    </div>
  )
}
