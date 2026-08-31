'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle, Clock, MapPin, Users, Eye, EyeOff } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { cn } from '@/lib/utils'
import Recaptcha, { RecaptchaHandle } from '@/components/Recaptcha'
import { createClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type ExistingCustomer = { id: string; first_name: string; last_name: string; email: string }

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

// ── Inner form — has access to Stripe hooks ────────────────────────────────
function CheckoutForm({
  roomId, roomName, locationName, locationSlug,
  capacity, pricePerHour, date, start, end, startLabel, endLabel,
  estimatedTotal, formattedDate, existingCustomer, onSuccess,
}: Props & { estimatedTotal: number; formattedDate: string; existingCustomer: ExistingCustomer | null; onSuccess: (email: string) => void }) {
  const stripe   = useStripe()
  const elements = useElements()

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,   setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone,   setPhone]   = useState('')
  const [company, setCompany] = useState('')
  const [notes,   setNotes]   = useState('')
  const [agreed,  setAgreed]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<RecaptchaHandle>(null)
  // A separate widget for account creation, only shown for a new signup —
  // a v2 token is single-use, so the same one can't also verify the
  // booking request below. Account creation had no captcha at all before
  // this (2026-08-31) — someone could hit /api/book/create-account
  // directly and mass-create accounts with nothing but the IP rate limit
  // in the way.
  const [acctRecaptchaToken, setAcctRecaptchaToken] = useState<string | null>(null)
  const acctRecaptchaRef = useRef<RecaptchaHandle>(null)

  async function handleSignOut() {
    await createClient().auth.signOut()
    window.location.reload()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    if (!agreed) { setError('Please agree to the cancellation policy.'); return }
    if (!existingCustomer && !acctRecaptchaToken) { setError('Please complete the "I\'m not a robot" check.'); return }
    if (!recaptchaToken) { setError('Please complete the "I\'m not a robot" check.'); return }

    setLoading(true)
    setError(null)

    // 0. Create the account first if this isn't an already-logged-in
    // customer — /book now requires one, same as day-pass.
    let customerId = existingCustomer?.id
    const guestName = existingCustomer ? `${existingCustomer.first_name} ${existingCustomer.last_name}` : `${firstName.trim()} ${lastName.trim()}`
    const guestEmail = existingCustomer ? existingCustomer.email : email.trim()

    if (!customerId) {
      const accRes = await fetch('/api/book/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password, recaptcha_token: acctRecaptchaToken }),
      })
      const accData = await accRes.json()
      if (!accRes.ok) {
        setError(accData.error ?? 'Something went wrong creating your account.')
        acctRecaptchaRef.current?.reset()
        setLoading(false)
        return
      }
      customerId = accData.customer_id

      // Creating the account via the admin API (server-side) doesn't log
      // the browser in — sign in explicitly so they're actually
      // authenticated once this completes, not just left with an account
      // that exists but no session.
      await createClient().auth.signInWithPassword({ email, password })
    }

    // 1. Confirm payment with Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
      setError('Payment was not completed. Please try again.')
      setLoading(false)
      return
    }

    // 2. Create booking in DB
    const res = await fetch('/api/book/request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        room_id:            roomId,
        date, start, end,
        customer_id:        customerId,
        name:               guestName,
        email:              guestEmail,
        phone:              phone.trim(),
        company_name:       company.trim() || null,
        notes:              notes.trim() || null,
        stripe_payment_intent_id: paymentIntent.id,
        recaptcha_token:    recaptchaToken,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      onSuccess(guestEmail)
    } else {
      setError(data.error ?? 'Booking saved but something went wrong. Contact us at bookings@bizhaus.com.')
      // The reCAPTCHA token is single-use — even though booking failed for an
      // unrelated reason, Google may have already consumed it. Reset so a
      // retry gets a fresh one instead of silently failing on resubmit.
      recaptchaRef.current?.reset()
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Your details */}
      <div className="space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-gray-900 text-lg">Your details</h2>
          {!existingCustomer && (
            <span className="text-sm text-gray-500">Have an account? <a href="/day-pass/login" className="font-semibold text-booking-600 hover:text-booking-700">Log in</a></span>
          )}
        </div>

        {existingCustomer && (
          <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <span>Booking as <span className="font-medium text-gray-700">{existingCustomer.first_name} {existingCustomer.last_name}</span> ({existingCustomer.email})</span>
            <button type="button" onClick={handleSignOut} className="text-gray-400 hover:text-gray-600 underline">Not you? Sign out</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {!existingCustomer && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">First name <span className="text-red-500">*</span></label>
                <input required value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name <span className="text-red-500">*</span></label>
                <input required value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
            <input required type="tel" value={phone} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                if (digits.length <= 3) setPhone(digits.length > 0 ? `(${digits}` : '')
                else if (digits.length <= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`)
                else setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`)
              }}
              placeholder="(310) 555-0000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={company} onChange={e => setCompany(e.target.value)}
              placeholder="Acme Inc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Anything we should know about your booking…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500 resize-none" />
        </div>

        {!existingCustomer && (
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Create a password</h3>
              <p className="text-sm text-gray-500">We&apos;ll create your BizHaus account at the same time, so you can view and manage this booking later.</p>
            </div>
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input required type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Must be at least 8 characters.</p>
            </div>
            <Recaptcha ref={acctRecaptchaRef} onChange={setAcctRecaptchaToken} />
            <p className="text-xs text-gray-400 leading-relaxed">
              By continuing, I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-booking-600 hover:text-booking-700">Website Terms of Service</a> and the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-booking-600 hover:text-booking-700">Privacy Policy</a>.
            </p>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900 text-lg">Payment</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <PaymentElement />
        </div>
      </div>

      {/* Cancellation policy */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-3">
        <p><span className="font-semibold text-gray-900">Cancellation policy:</span> Bookings are non-refundable. If you need to cancel, contact us at{' '}
          <a href="mailto:bookings@bizhaus.com" className="text-booking-600 hover:underline">bookings@bizhaus.com</a>{' '}
          to inquire about credit toward a future booking.</p>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            className="mt-0.5 rounded border-gray-300" />
          <span>I understand and agree to the cancellation policy.</span>
        </label>
      </div>

      <div className="flex justify-center">
        <Recaptcha ref={recaptchaRef} onChange={setRecaptchaToken} />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !agreed || !stripe || !recaptchaToken || (!existingCustomer && (password.length < 8 || !acctRecaptchaToken))}
        className={cn(
          'w-full py-3.5 rounded-lg text-sm font-semibold transition-colors',
          loading || !agreed || !stripe || !recaptchaToken || (!existingCustomer && (password.length < 8 || !acctRecaptchaToken))
            ? 'bg-booking-300 text-white cursor-not-allowed'
            : 'bg-booking-600 hover:bg-booking-700 text-white'
        )}
      >
        {loading ? 'Processing…' : `Pay $${estimatedTotal.toFixed(0)}`}
      </button>
    </form>
  )
}

// ── Outer wrapper — loads Stripe + fetches client secret ──────────────────
export default function BookingForm(props: Props) {
  const { pricePerHour, start, end, date, roomId, locationSlug, roomName, locationName, capacity, startLabel, endLabel } = props

  const durationHours  = (slotToMinutes(end) - slotToMinutes(start)) / 60
  const estimatedTotal = durationHours * pricePerHour
  const formattedDate  = format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [confirmed,    setConfirmed]    = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const [existingCustomer, setExistingCustomer] = useState<ExistingCustomer | null>(null)

  useEffect(() => {
    fetch('/api/book/create-payment-intent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ room_id: roomId, date, start, end }),
    })
      .then(r => r.json())
      .then(d => setClientSecret(d.clientSecret))
  }, [roomId, date, start, end])

  // Same shared booking_customers account system as day-pass — if this
  // visitor is already signed in (e.g. came from day-pass, or booking
  // again), skip straight past account creation.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: customer } = await supabase
        .from('booking_customers')
        .select('id, first_name, last_name, email')
        .eq('id', user.id)
        .single()
      if (customer) setExistingCustomer(customer)
    })
  }, [])

  // ── Confirmation ────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking confirmed!</h1>
          <p className="text-gray-500 mt-2">A confirmation has been sent to {confirmedEmail}.</p>
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
        </div>
        <Link href="/book" className="inline-flex items-center gap-1.5 text-sm text-booking-600 hover:text-booking-700 font-medium">
          ← Back to all locations
        </Link>
      </div>
    )
  }

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
            <MapPin size={15} className="mt-0.5 shrink-0 text-booking-600" />
            <div>
              <p className="font-medium text-gray-900">{roomName}</p>
              <p>{locationName}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-gray-600">
            <Clock size={15} className="mt-0.5 shrink-0 text-booking-600" />
            <div>
              <p className="font-medium text-gray-900">{startLabel} – {endLabel}</p>
              <p>{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-gray-600">
            <Users size={15} className="mt-0.5 shrink-0 text-booking-600" />
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

      {!clientSecret ? (
        <div className="text-center py-12 text-sm text-gray-400">Loading payment form…</div>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <CheckoutForm
            {...props}
            estimatedTotal={estimatedTotal}
            formattedDate={formattedDate}
            existingCustomer={existingCustomer}
            onSuccess={(email) => { setConfirmed(true); setConfirmedEmail(email) }}
          />
        </Elements>
      )}
    </div>
  )
}
