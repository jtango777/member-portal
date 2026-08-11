'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoUploadDialog from '@/components/PhotoUploadDialog'
import AnnouncementPopup from '@/components/AnnouncementPopup'

type Announcement = { id: string; message: string }

type Props = {
  hasAvatar: boolean
  avatarPromptDismissed: boolean
  announcement: Announcement | null
}

// Coordinates the two "first thing you see" reminders so they never stack
// on top of each other. An announcement (if any) shows first; the avatar
// prompt waits until it's been dismissed, rather than both popping up at
// once (which used to overlap and partially cover each other).
export default function OnboardingOverlays({ hasAvatar, avatarPromptDismissed, announcement }: Props) {
  const router = useRouter()
  const [announcementShowing, setAnnouncementShowing] = useState(!!announcement)
  // Dismissed permanently in the DB (persists across logins/devices), but
  // tracked in local state too so the dialog closes immediately without
  // waiting on the save + a full page refresh.
  const [dismissed, setDismissed] = useState(avatarPromptDismissed)

  const showAvatarPrompt = !hasAvatar && !dismissed && !announcementShowing

  async function dismissAvatarPrompt() {
    setDismissed(true)
    try {
      await fetch('/api/user/dismiss-avatar-prompt', { method: 'POST' })
    } catch (_) {
      // Best-effort — worst case it shows again next login, not the end of the world.
    }
  }

  return (
    <>
      {announcement && (
        <AnnouncementPopup
          announcementId={announcement.id}
          message={announcement.message}
          onDismissed={() => setAnnouncementShowing(false)}
        />
      )}
      <PhotoUploadDialog
        open={showAvatarPrompt}
        onOpenChange={open => { if (!open) dismissAvatarPrompt() }}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
