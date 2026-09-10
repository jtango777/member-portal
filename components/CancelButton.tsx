'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { IconAction } from '@/components/admin/AdminTable'
import CancelReservationDialog from '@/components/CancelReservationDialog'

export default function CancelButton({ reservationId, title }: { reservationId: string; title: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <IconAction
        icon={Trash2}
        label="Cancel reservation"
        onClick={() => setConfirming(true)}
        colorClass="text-gray-400 hover:bg-red-50 hover:text-red-600"
      />
      <CancelReservationDialog
        reservation={confirming ? { id: reservationId, title } : null}
        onOpenChange={setConfirming}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
