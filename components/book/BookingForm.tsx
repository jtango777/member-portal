'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle, Clock, MapPin, Users, Lock, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  roomId:       string
  roomName:     string
  locationName: string
  locationSlug: string
  capacity:     number
  pricePerHour: number
  date:         string
  start:        string
  end:          string
  startLabel:   string
  endLabel:     string
}

function slotToMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number)
  return h * 60 + m
}

export default function BookingForm({
  roomId, roomName, locationName, locationSlug,
  capacity, pricePerHour,
  date, start, end, startLabel, endLabel,
}: Props) {
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [company,     setCompany]     = useState('')
  const [notes,       setNotes]       = useState('')
  const [agreed,      setAgreed]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [bookingId,   setBookingId]   = useState<string | null>(null)

  const durationHours  = (slotToMinutes(end) - slotToMinutes(start)) / 60
  const estimatedTotal = durationHours * pricePerHour
  const formattedDate  = format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) { setError('Please agree to the cancellation policy.'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/book/request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        room_id:      roomId,
        date, start, end,
        name:         name.trim(),
        email:        email.trim(),
        phone:        phone.trim(),
        company_name: company.trim() || null,
        notes:        notes.trim() || null,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      setBookingId(data.booking_id)
    } else {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ── Confirmation ────────────────────────────────────────────────────────────
  if (bookingId) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking confirmed!</h1>
          <p className="text-gray-500 mt-2">A confirmation has been sent to {email}.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-3 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Room</span>
            <span className="font-medium text-gray-900">{roomName} · {locationName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">{formattedDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Time</span>
            <span className="font-medium text-gray-900">{startLabel} – {endLabel}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-500">Total paid</span>
            <span className="font-semibold text-gray-900">${estimatedTotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Reference</span>
            <span className="font-mono text-xs text-gray-600">{bookingId.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        <Link href="/book" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          ← Back to all locations
        </Link>
      </div>
    )
  }

  // ── Checkout ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Link href={`/book/${locationSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} /> Back to availability
      </Link>

      <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>

      {/* Booking summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-900">Booking summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin size={15} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">{roomName}</p>
              <p>{locationName}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-gray-600">
            <Clock size={15} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">{startLabel} – {endLabel}</p>
              <p>{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-gray-600">
            <Users size={15} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">Up to {capacity} people</p>
              <p>${pricePerHour}/hr · {durationHours}h</p>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-lg font-bold text-gray-900">${estimatedTotal.toFixed(0)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── Section 1: Your details ── */}
        <div className="space-y-5">
          <h2 className="font-semibold text-gray-900 text-lg">Your details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
              <input required value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
              <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(310) 555-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={company} onChange={e => setCompany(e.target.value)}
                placeholder="Acme Inc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder="Anything we should know about your booking…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* ── Section 2: Payment ── */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">Payment</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">

            {/* Card number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Card number</label>
              <div className="relative">
                <input
                  placeholder="1234 5678 9012 3456"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={19}
                />
                <CreditCard size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Expiry + CVC */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry</label>
                <input placeholder="MM / YY"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={7} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CVC</label>
                <input placeholder="123"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={4} />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Lock size={11} />
              Payments secured by Stripe
            </div>
          </div>
        </div>

        {/* Cancellation policy */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-3">
          <p><span className="font-semibold text-gray-900">Cancellation policy:</span> Bookings are non-refundable. If you need to cancel, contact us at{' '}
            <a href="mailto:bookings@bizhaus.com" className="text-blue-600 hover:underline">bookings@bizhaus.com</a>{' '}
            to inquire about credit toward a future booking.</p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 rounded border-gray-300" />
            <span>I understand and agree to the cancellation policy.</span>
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !agreed}
          className={cn(
            'w-full py-3.5 rounded-lg text-sm font-semibold transition-colors',
            loading || !agreed
              ? 'bg-blue-300 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          {loading ? 'Processing…' : `Pay $${estimatedTotal.toFixed(0)}`}
        </button>
      </form>
    </div>
  )
}
