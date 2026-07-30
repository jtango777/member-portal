'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X, Send, Pencil } from 'lucide-react'
import AnnouncementCard from '../AnnouncementCard'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
  onConfirm: () => void
  posting: boolean
}

// Shows an admin exactly what members will see (reusing the same
// AnnouncementCard the real popup renders) before they broadcast it, so
// there's no surprise about what's about to go out to everyone.
export default function AnnouncementPreviewDialog({ open, onOpenChange, message, onConfirm, posting }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-[92vw] sm:w-full max-w-sm z-50">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <Dialog.Title className="font-semibold text-gray-900 text-sm">Preview</Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="p-5">
            <p className="text-xs text-gray-400 mb-3">This is exactly what members will see:</p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <AnnouncementCard message={message} TitleAs="p" DescriptionAs="p" />
              <div className="w-full bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg text-center mt-5 opacity-60">
                Got it
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              It'll pop up for every active member the next time they open the portal.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
            <Dialog.Close asChild>
              <button className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">
                <Pencil size={14} /> Keep editing
              </button>
            </Dialog.Close>
            <button onClick={onConfirm} disabled={posting}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              <Send size={14} /> {posting ? 'Posting…' : 'Post to all members'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
