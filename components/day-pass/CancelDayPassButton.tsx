'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

// Day pass only — never shown for room bookings, which don't allow
// self-serve cancellation at all (Caroline, 2026-08-31). The parent page
// only renders this when the booking is still more than 12 hours out;
// /api/day-pass/cancel re-checks that for real before refunding anything.
export default function CancelDayPassButton({ confirmationNumber }: { confirmationNumber: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

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

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
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
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-sm font-medium text-gray-400 hover:text-red-600 transition-colors">
      Cancel
    </button>
  )
}
