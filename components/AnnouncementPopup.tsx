'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useNavBottom } from '@/lib/useNavBottom'
import AnnouncementCard from './AnnouncementCard'

type Props = {
  announcementId: string
  message: string
}

export default function AnnouncementPopup({ announcementId, message }: Props) {
  const [open, setOpen] = useState(true)
  const [dismissing, setDismissing] = useState(false)
  const navBottom = useNavBottom()

  async function dismiss() {
    setDismissing(true)
    setOpen(false)
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
        <Dialog.Overlay className="fixed inset-x-0 bottom-0 bg-black/40 z-40" style={{ top: navBottom }} />
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center pointer-events-none p-4" style={{ top: navBottom }}>
          <Dialog.Content className="pointer-events-auto relative bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
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
