'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoUploadDialog from '@/components/PhotoUploadDialog'

export default function AvatarUploadPrompt({ hasAvatar }: { hasAvatar: boolean }) {
  const [open, setOpen] = useState(!hasAvatar)
  const router = useRouter()

  return (
    <PhotoUploadDialog
      open={open}
      onOpenChange={setOpen}
      onSuccess={() => router.refresh()}
    />
  )
}
