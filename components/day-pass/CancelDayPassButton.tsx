'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// Day pass only — never shown for room bookings, which don't allow
// self-serve cancellation at all (Caroline, 2026-08-31). The parent page
// only renders this when the booking is still more than 12 hours out;
// /api/day-pass/cancel re-checks that for real before refunding anything.
//
// Single continuously-animated width, not two elements collapsing/expanding
// in opposite directions at once — that's what made it look jumpy instead of
// like the accordion feel elsewhere on the site. The two states are stacked
// absolutely and crossfaded; the wrapper transitions to the exact pixel
// width of whichever one is showing, measured for real via ref instead of
// guessed, so it's one smooth motion in any browser.
export default function CancelDayPassButton({ confirmationNumber }: { confirmationNumber: string }) {
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
    const res = await fetch('/api/day-pass/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_number: confirmationNumber }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Cancelled — $${(data.refundedCents / 100).toFixed(2)} refunded.`)
      router.refresh()
    } else {
      toast.error(data.error ?? 'Could not cancel this booking.')
    }
    setConfirming(false)
    setLoading(false)
  }

  return (
    <div
      className="relative h-5 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width }}
    >
      <div
        ref={collapsedRef}
        className={cn(
          'absolute inset-y-0 left-0 flex items-center whitespace-nowrap transition-opacity duration-200',
          confirming ? 'pointer-events-none opacity-0' : 'opacity-100 delay-100'
        )}
      >
        <button
          onClick={() => setConfirming(true)}
          className="text-sm font-medium text-gray-400 hover:text-red-600 transition-colors"
        >
          Cancel
        </button>
      </div>
      <div
        ref={expandedRef}
        className={cn(
          'absolute inset-y-0 left-0 flex items-center gap-2 whitespace-nowrap text-xs',
          'transition-opacity duration-200',
          confirming ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
        )}
      >
        <span className="text-gray-500">Cancel &amp; refund?</span>
        <button onClick={handleCancel} disabled={loading}
          className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">
          {loading ? 'Cancelling…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} disabled={loading}
          className="font-medium text-gray-400 hover:text-gray-600">
          No
        </button>
      </div>
    </div>
  )
}
