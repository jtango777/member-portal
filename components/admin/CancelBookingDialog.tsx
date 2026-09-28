'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// Staff cancellation override (Caroline, 2026-09-28).
//
// Customers can only cancel a day pass before its 9am start, and conference
// rooms say plainly that bookings are non-refundable. Staff need to be able
// to do it anyway when someone calls, with the choice of putting the money
// back on the card or holding it as credit toward a future date.
//
// Kept deliberately quiet: the trigger is a small grey "Cancel" that only
// appears when you hover the row, so it isn't the first thing anyone sees.

export type CancelTarget =
  | { type: 'day_pass'; confirmationNumber: string; who: string; dates: string[]; pricePerDayCents: number; location: string }
  | { type: 'room'; id: string; who: string; when: string; amountCents: number; location: string }

export function CancelRowButton({ target }: { target: CancelTarget }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-600 hover:underline transition-opacity"
      >
        Cancel
      </button>
      {open && <CancelBookingDialog target={target} onClose={() => setOpen(false)} />}
    </>
  )
}

function CancelBookingDialog({ target, onClose }: { target: CancelTarget; onClose: () => void }) {
  const router = useRouter()
  const isPass = target.type === 'day_pass'
  const allDates = isPass ? target.dates : []
  const [dates, setDates] = useState<string[]>(allDates)
  const [refund, setRefund] = useState(true)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountCents = isPass ? dates.length * target.pricePerDayCents : target.amountCents
  const nothingPicked = isPass && dates.length === 0

  function toggleDate(d: string) {
    setDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function submit() {
    setBusy(true)
    setError(null)
    const body = isPass
      ? { type: 'day_pass', confirmation_number: target.confirmationNumber, dates, refund, notify }
      : { type: 'room', id: target.id, refund, notify }
    try {
      const res = await fetch('/api/admin/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        setBusy(false)
        return
      }
      onClose()
      router.refresh()
    } catch {
      setError('Could not reach the server. Nothing was cancelled.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">
          Cancel {isPass ? 'day pass' : 'room booking'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {target.who} · {target.location}
          {!isPass && <> · {target.when}</>}
        </p>

        {isPass && allDates.length > 1 && (
          <div className="mt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Days to cancel</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {allDates.map(d => (
                <label key={d} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={dates.includes(d)} onChange={() => toggleDate(d)} className="rounded border-gray-300" />
                  {format(new Date(d + 'T12:00:00'), 'EEE, MMM d, yyyy')}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">What happens to the money</div>
          <div className="mt-2 flex flex-col gap-1.5">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="radio" checked={refund} onChange={() => setRefund(true)} className="mt-1 border-gray-300" />
              <span>
                Refund ${(amountCents / 100).toFixed(2)} to their card
                <span className="block text-xs text-gray-400">Shows up on their statement in 5 to 10 days. The QuickBooks receipt is voided.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="radio" checked={!refund} onChange={() => setRefund(false)} className="mt-1 border-gray-300" />
              <span>
                Hold ${(amountCents / 100).toFixed(2)} as credit for a future date
                <span className="block text-xs text-gray-400">No money moves. Book the new date for them by hand when they tell you.</span>
              </span>
            </label>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="rounded border-gray-300" />
          Email the customer about it
        </label>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Never mind
          </button>
          <button
            onClick={submit}
            disabled={busy || nothingPicked}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white',
              busy || nothingPicked ? 'bg-gray-300' : 'bg-red-600 hover:bg-red-700'
            )}
          >
            {busy ? 'Working…' : refund ? `Cancel and refund $${(amountCents / 100).toFixed(2)}` : 'Cancel and hold credit'}
          </button>
        </div>
      </div>
    </div>
  )
}
