'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { IconAction } from './AdminTable'

// Staff cancellation override (Caroline, 2026-09-28).
//
// Customers can only cancel a day pass before its 9am start, and conference
// rooms are sold as non-refundable. Neither rule binds staff: if someone
// rings up, BizHaus can cancel it whatever the clock says, and decide
// whether the money goes back on the card or stays with us as credit toward
// a future date. That second option is the usual answer for rooms and is
// deliberately not advertised anywhere customer-facing.
//
// Visually this is the same trash-can-then-confirm pattern as every other
// destructive action in the admin: IconAction + Trash2 for the trigger
// (like components/CancelButton.tsx), and the ArchiveFaceDialog box for the
// confirm. Built as its own hover-only text link first, which Caroline
// rightly called out — reuse the precedent rather than reinventing it.

export type CancelTarget =
  | { type: 'day_pass'; confirmationNumber: string; who: string; dates: string[]; pricePerDayCents: number; location: string }
  | { type: 'room'; id: string; who: string; when: string; amountCents: number; location: string }

export function CancelRowButton({ target }: { target: CancelTarget }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconAction
        icon={Trash2}
        label={target.type === 'day_pass' ? 'Cancel day pass' : 'Cancel booking'}
        onClick={() => setOpen(true)}
        colorClass="text-gray-400 hover:bg-red-50 hover:text-red-600"
      />
      <CancelBookingDialog target={target} open={open} onOpenChange={setOpen} />
    </>
  )
}

function CancelBookingDialog({ target, open, onOpenChange }: {
  target: CancelTarget
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const isPass = target.type === 'day_pass'
  const allDates = isPass ? target.dates : []
  const [dates, setDates] = useState<string[]>(allDates)
  const [refund, setRefund] = useState(true)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  const amountCents = isPass ? dates.length * target.pricePerDayCents : target.amountCents
  const amount = `$${(amountCents / 100).toFixed(2)}`
  const nothingPicked = isPass && dates.length === 0

  const prettyDate = (d: string) => format(new Date(d + 'T12:00:00'), 'EEE, MMM d, yyyy')
  const detail = isPass
    ? `${allDates.length > 1 ? `${allDates.length} days` : prettyDate(allDates[0])} · ${target.location}`
    : `${target.when} · ${target.location}`

  function toggleDate(d: string) {
    setDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function handleCancel() {
    setBusy(true)
    const body = isPass
      ? { type: 'day_pass', confirmation_number: target.confirmationNumber, dates, refund, notify }
      : { type: 'room', id: target.id, refund, notify }
    const res = await fetch('/api/admin/cancel-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(refund ? `Cancelled and refunded ${amount}` : `Cancelled, ${amount} held as credit`)
      onOpenChange(false)
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Could not cancel')
    }
    setBusy(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <div className="flex items-center justify-between mb-3">
              <Dialog.Title className="text-sm font-semibold text-gray-900">
                Cancel {target.who}&apos;s {isPass ? 'day pass' : 'room booking'}?
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>

            <p className="text-xs text-gray-500 mb-6 leading-relaxed">{detail}</p>

            {isPass && allDates.length > 1 && (
              <div className="mb-6">
                <div className="text-xs font-medium text-gray-500 mb-2">Which days?</div>
                <div className="flex flex-col gap-1.5">
                  {allDates.map(d => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                      <input type="checkbox" checked={dates.includes(d)} onChange={() => toggleDate(d)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      {prettyDate(d)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer select-none mb-4">
              <RefreshCw size={14} className={refund ? 'text-blue-600' : 'text-gray-300'} />
              <span className="relative inline-flex h-4 w-7 flex-shrink-0 items-center">
                <input type="checkbox" checked={refund} onChange={e => setRefund(e.target.checked)} className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors duration-200" />
                <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3" />
              </span>
              <span className="text-sm text-gray-700">Refund {amount} to their card?</span>
            </label>
            <p className="text-xs text-gray-400 mb-6 -mt-2 ml-8 leading-relaxed">
              {refund
                ? 'Back on their statement in 5 to 10 days, and the QuickBooks receipt is voided.'
                : `No money moves. ${amount} stays with us toward a future booking, which you book for them by hand.`}
            </p>

            <label className="flex items-center gap-2 cursor-pointer select-none mb-6">
              <span className="relative inline-flex h-4 w-7 flex-shrink-0 items-center ml-[22px]">
                <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors duration-200" />
                <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3" />
              </span>
              <span className="text-sm text-gray-700">Email them about it?</span>
            </label>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2">
                Never mind
              </Dialog.Close>
              <button onClick={handleCancel} disabled={busy || nothingPicked}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {busy ? 'Cancelling…' : refund ? `Cancel and refund ${amount}` : 'Cancel and hold credit'}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
