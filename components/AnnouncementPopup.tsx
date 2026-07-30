'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
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
          <Dialog.Content className="pointer-events-auto bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <div className="mb-5">
              <AnnouncementCard message={message} TitleAs={Dialog.Title} DescriptionAs={Dialog.Description} />
            </div>
            <button onClick={dismiss} disabled={dismissing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Got it
            </button>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
