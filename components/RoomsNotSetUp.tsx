'use client'

import { useState } from 'react'
import { DoorOpen, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Props = { alreadyRequested: boolean; contactEmail: string }

export default function RoomsNotSetUp({ alreadyRequested, contactEmail }: Props) {
  const [requested, setRequested] = useState(alreadyRequested)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function requestAccess() {
    setSubmitting(true)
    const res = await fetch('/api/profile/request-room-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requested: true }),
    })
    if (res.ok) {
      toast.success("Request sent — we'll be in touch once you're set up.")
      setRequested(true)
      router.refresh()
    } else {
      toast.error('Something went wrong — try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <DoorOpen size={28} className="text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-semibold text-gray-900 mb-3">Need to book a conference room?</p>

        {requested ? (
          <p className="text-sm text-gray-500">
            Thanks! We've let our staff know — you'll be able to book once they set you up.
          </p>
        ) : (
          <div className="text-sm text-gray-500 space-y-3">
            <p>
              If you do this often, register for the member portal to book rooms yourself. If you don't need it often, just send us a request — email, Slack, or stop by the front desk!
            </p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={requestAccess} disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {submitting ? 'Sending…' : 'Register for Rooms'}
              </button>
              <a href={`mailto:${contactEmail}?subject=${encodeURIComponent('Room booking request')}`}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-lg">
                <Mail size={15} /> Email Us
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
