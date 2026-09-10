'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoUploadDialog from '@/components/PhotoUploadDialog'
import AnnouncementPopup from '@/components/AnnouncementPopup'

type Announcement = { id: string; message: string }

type Props = {
  avatarUrl: string | null
  avatarPromptDismissed: boolean
  // True only on the very first dashboard visit after signup (profile.welcomed
  // is still false — /dashboard flips it on that same visit).
  isFirstSignIn: boolean
  announcement: Announcement | null
}

// Coordinates the two "first thing you see" reminders so they never stack
// on top of each other. An announcement (if any) shows first; the avatar
// prompt waits until it's been dismissed, rather than both popping up at
// once (which used to overlap and partially cover each other).
//
// Gated on first sign-in, not on "has no photo yet". The old !hasAvatar
// gate skipped anyone whose photo we pre-linked from the directory import,
// so they never got to confirm it or add LinkedIn. Dropping that gate
// entirely swung too far the other way — every existing member with a
// photo (who'd never seen this, so never dismissed it) suddenly got the
// prompt on their next login. profile.welcomed is the signal that's
// actually about "is this the initial signup". Caught 2026-09-10.
export default function OnboardingOverlays({ avatarUrl, avatarPromptDismissed, isFirstSignIn, announcement }: Props) {
  const router = useRouter()
  const [announcementShowing, setAnnouncementShowing] = useState(!!announcement)
  // Dismissed permanently in the DB (persists across logins/devices), but
  // tracked in local state too so the dialog closes immediately without
  // waiting on the save + a full page refresh.
  const [dismissed, setDismissed] = useState(avatarPromptDismissed)

  const showAvatarPrompt = isFirstSignIn && !dismissed && !announcementShowing

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
        offerLinkedin
        currentImageUrl={avatarUrl}
        title={avatarUrl ? 'Change or recrop your photo' : undefined}
        description={avatarUrl
          ? 'This is the photo already on file for you — recrop it, swap it, or leave it as-is.'
          : undefined}
      />
    </>
  )
}
