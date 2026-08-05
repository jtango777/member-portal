'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoUploadDialog from '@/components/PhotoUploadDialog'
import AnnouncementPopup from '@/components/AnnouncementPopup'

type Announcement = { id: string; message: string }

type Props = {
  hasAvatar: boolean
  announcement: Announcement | null
}

// Once a member dismisses the "add your photo" reminder, don't put it back
// in front of them on every single page navigation for the rest of this
// browser session — that reads as naggy. It'll show again next time they
// log in (a fresh session) as long as they still have no photo.
const AVATAR_DISMISS_KEY = 'bizhaus:avatarPromptDismissed'

function wasAvatarPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AVATAR_DISMISS_KEY) === '1'
}

// Coordinates the two "first thing you see" reminders so they never stack
// on top of each other. An announcement (if any) shows first; the avatar
// prompt waits until it's been dismissed, rather than both popping up at
// once (which used to overlap and partially cover each other).
export default function OnboardingOverlays({ hasAvatar, announcement }: Props) {
  const router = useRouter()
  const [announcementShowing, setAnnouncementShowing] = useState(!!announcement)
  const [avatarDismissed, setAvatarDismissed] = useState(wasAvatarPromptDismissed)

  const showAvatarPrompt = !hasAvatar && !avatarDismissed && !announcementShowing

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
        onOpenChange={open => {
          if (!open) {
            sessionStorage.setItem(AVATAR_DISMISS_KEY, '1')
            setAvatarDismissed(true)
          }
        }}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
