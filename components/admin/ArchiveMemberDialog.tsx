'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = {
  member: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function ArchiveMemberDialog({ member, onOpenChange, onSuccess }: Props) {
  const [unmarkInPipedrive, setUnmarkInPipedrive] = useState(true)
  const [archiving, setArchiving] = useState(false)

  async function handleArchive() {
    if (!member) return
    setArchiving(true)
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unmarkInPipedrive }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success('Archived')
      if (unmarkInPipedrive && data.pipedriveMatched === false) {
        toast('No matching contact found in Pipedrive — unmark them there manually.', { icon: '⚠️' })
      }
      onOpenChange(false)
      onSuccess()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to archive')
    }
    setArchiving(false)
  }

  return (
    <Dialog.Root open={!!member} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-sm font-semibold text-gray-900">
                Archive {member?.name}?
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none mb-6">
              <RefreshCw size={14} className={unmarkInPipedrive ? 'text-blue-600' : 'text-gray-300'} />
              <span className="relative inline-flex h-4 w-7 flex-shrink-0 items-center">
                <input type="checkbox" checked={unmarkInPipedrive}
                  onChange={e => setUnmarkInPipedrive(e.target.checked)}
                  className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors duration-200" />
                <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3" />
              </span>
              <span className="text-sm text-gray-700">Unmark as current member in Pipedrive?</span>
            </label>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2">
                Cancel
              </Dialog.Close>
              <button onClick={handleArchive} disabled={archiving}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
