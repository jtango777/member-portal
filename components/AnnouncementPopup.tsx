'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useNavBottom } from '@/lib/useNavBottom'
import AnnouncementCard from './AnnouncementCard'

type Props = {
  announcementId: string
  message: string
  // Called once this popup has closed (by X, Escape, or clicking outside),
  // so a caller stacking another reminder on top of this one — e.g. the
  // "add your photo" prompt — can wait its turn instead of showing both
  // at once.
  onDismissed?: () => void
}

export default function AnnouncementPopup({ announcementId, message, onDismissed }: Props) {
  const [open, setOpen] = useState(true)
  const [dismissing, setDismissing] = useState(false)
  const navBottom = useNavBottom()

  async function dismiss() {
    setDismissing(true)
    setOpen(false)
    onDismissed?.()
    await fetch('/api/profile/dismiss-announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcement_id: announcementId }),
    })
    setDismissing(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) dismiss() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-x-0 bottom-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" style={{ top: navBottom }} />
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center pointer-events-none p-4" style={{ top: navBottom }}>
          <Dialog.Content className="pointer-events-auto relative bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <button onClick={dismiss} disabled={dismissing} aria-label="Dismiss"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors">
              <X size={16} />
            </button>
            <AnnouncementCard message={message} TitleAs={Dialog.Title} DescriptionAs={Dialog.Description} />
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
