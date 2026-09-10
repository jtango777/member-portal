'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = {
  reservation: { id: string; title: string } | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Same shape as admin/ArchiveMemberDialog — a real confirm dialog instead
// of an inline row swap. Every inline version (grid overlap+fade,
// grid-template-columns, max-width, then a plain instant swap) still read
// as jumpy or out of place next to the row's icons, so this drops the row
// entirely in favor of what the Members table already does for its own
// destructive action.
export default function CancelReservationDialog({ reservation, onOpenChange, onSuccess }: Props) {
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    if (!reservation) return
    setCancelling(true)
    const res = await fetch(`/api/reservations/${reservation.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Reservation cancelled')
      onOpenChange(false)
      onSuccess()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Could not cancel')
    }
    setCancelling(false)
  }

  return (
    <Dialog.Root open={!!reservation} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <div className="flex items-center justify-between mb-2">
              <Dialog.Title className="text-sm font-semibold text-gray-900">
                Cancel {reservation?.title}?
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>
            <Dialog.Description className="text-sm text-gray-500 mb-6">
              This frees up the room and can't be undone.
            </Dialog.Description>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2">
                Never mind
              </Dialog.Close>
              <button onClick={handleCancel} disabled={cancelling}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
