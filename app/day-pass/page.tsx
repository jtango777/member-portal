'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, CheckCircle, Check } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { eachDayOfInterval, getDay, format as formatDate } from 'date-fns'
import DayPassDatePicker, { DateMode } from '@/components/DayPassDatePicker'
import Recaptcha, { RecaptchaHandle } from '@/components/Recaptcha'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type ExistingCustomer = { id: string; first_name: string; last_name: string; email: string }

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Locations are hardcoded here rather than fetched from the `locations`
// table — the ids match the real rows so the API routes' foreign key
// checks pass, but wiring this up to a live query is a later cleanup.
// Photos reuse the same open-space shots /book uses for its own location
// banners (components/book/AvailabilityView.tsx) — same 3 locations,
// Caroline confirmed all three are accurate as of 2026-08-31 (Costa
// Mesa's photo was replaced that day, the old one showed an unrelated
// outdoor patio rather than the desk area).
const LOCATIONS = [
  { id: '11111111-1111-1111-1111-111111111101', name: 'El Segundo', phone: '(310) 870-1730', address: '1730 E Holly Ave, El Segundo, CA 90245', photo: '/rooms/es-open-space.jpg' },
  { id: '11111111-1111-1111-1111-111111111102', name: 'Marina del Rey', phone: '(310) 596-1990', address: '4223 Glencoe Ave Ste C215, Marina Del Rey, CA 90292', photo: '/rooms/mdr-open-space.jpg', photoPosition: 'center 70%' },
  { id: '11111111-1111-1111-1111-111111111103', name: 'Costa Mesa', phone: '(949) 800-8660', address: '2942 Century Pl, Costa Mesa, CA 92626', photo: '/rooms/cm-open-space.jpg' },
] as const

const DAY_PASS_PRICE = 30

type Section = 'reservation' | 'details'
type Phase = Section | 'confirmation'

// Weekday (Mon–Fri) dates in [start, end], inclusive — used only to check
// whether a multi-day selection happens to be one unbroken run, so it can
// still get the nicer "Aug 15 – Aug 30 (5 days)" label instead of just
// "5 days selected". Day passes are Monday–Friday only either way.
function businessDaysBetween(start: string, end: string): string[] {
  if (!start) return []
  const days = eachDayOfInterval({ start: new Date(start + 'T12:00:00'), end: new Date((end || start) + 'T12:00:00') })
  return days.filter(d => { const day = getDay(d); return day !== 0 && day !== 6 }).map(d => formatDate(d, 'yyyy-MM-dd'))
}

function isContiguousRange(sortedDates: string[]): boolean {
  if (sortedDates.length < 2) return true
  return businessDaysBetween(sortedDates[0], sortedDates[sortedDates.length - 1]).length === sortedDates.length
}

export default function DayPassPage() {
  const [phase, setPhase] = useState<Phase>('reservation')
  const [locationId, setLocationId] = useState<string>(LOCATIONS[0].id)
  const [dateMode, setDateMode] = useState<DateMode>('single')
  const [selectedDates, setSelectedDates] = useState<string[]>(['2026-08-20'])

  // Set once the account is created — the payment step needs this to know
  // who's paying, and the request step needs it to link the reservation.
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [confirmationNumber, setConfirmationNumber] = useState('')

  // A customer who's already signed in (e.g. via "+ Reserve another" from
  // their account page) shouldn't be walked through account creation again
  // — that only ever fails with "account already exists". Check once on
  // mount and skip straight to payment for them.
  const [existingCustomer, setExistingCustomer] = useState<ExistingCustomer | null>(null)

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

  const selectedLocation = LOCATIONS.find(l => l.id === locationId) ?? LOCATIONS[0]
  const dates = [...selectedDates].sort()
  const formattedDateRange = dates.length === 0
    ? ''
    : dates.length === 1
    ? formatDate(new Date(dates[0] + 'T12:00:00'), 'MMM d, yyyy')
    : isContiguousRange(dates)
    ? `${formatDate(new Date(dates[0] + 'T12:00:00'), 'MMM d')} – ${formatDate(new Date(dates[dates.length - 1] + 'T12:00:00'), 'MMM d, yyyy')} (${dates.length} days)`
    : `${dates.length} days selected`

  function restart() {
    setPhase('reservation')
    setLocationId(LOCATIONS[0].id)
    setCustomerId(null)
    setClientSecret(null)
    setGuestName('')
    setGuestEmail('')
  }

  if (phase === 'confirmation') {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <StepConfirmation
          loc={selectedLocation}
          dates={dates}
          guestName={guestName}
          confirmationNumber={confirmationNumber}
          onRestart={restart}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1.5">Reserve a Day Pass</h1>
        <p className="text-sm text-gray-500 mb-8">Coworking access, by the day.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3 min-w-0 flex flex-col gap-3">

          <AccordionSection
            number={1}
            title="Your Reservation"
            state={phase === 'reservation' ? 'active' : 'complete'}
            summary={`${selectedLocation.name} · ${formattedDateRange}`}
            onEdit={() => setPhase('reservation')}
          >
            <ReservationFields
              locationId={locationId} setLocationId={setLocationId}
              dateMode={dateMode} setDateMode={setDateMode}
              selectedDates={selectedDates} setSelectedDates={setSelectedDates}
              dates={dates}
              onContinue={() => setPhase('details')}
            />
          </AccordionSection>

          <AccordionSection
            number={2}
            title="Your Details"
            state={phase === 'details' ? 'active' : 'upcoming'}
            summary={null}
            onEdit={undefined}
          >
            <DetailsAndPayment
              locationId={locationId}
              locationName={selectedLocation.name}
              dates={dates}
              existingCustomer={existingCustomer}
              customerId={customerId}
              setCustomerId={setCustomerId}
              clientSecret={clientSecret}
              setClientSecret={setClientSecret}
              guestName={guestName}
              setGuestName={setGuestName}
              guestEmail={guestEmail}
              setGuestEmail={setGuestEmail}
              onSuccess={(confNum) => { setConfirmationNumber(confNum); setPhase('confirmation') }}
            />
          </AccordionSection>

        </div>

        <div className="lg:col-span-2 sticky top-20">
          <PriceSummary days={dates.length} />
        </div>
      </div>
    </div>
  )
}

// ── Accordion shell ──────────────────────────────────────────────────────
//
// Three visual states per section:
//  - "upcoming": not reached yet — grayed header only, no content, no click
//  - "active": the section being worked on — full header + expanded content
//  - "complete": already finished — collapsed to a summary row + Change link

function AccordionSection({ number, title, state, summary, onEdit, children }: {
  number: number
  title: string
  state: 'upcoming' | 'active' | 'complete'
  summary: string | null
  onEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-colors',
      state === 'active' ? 'border-booking-600 ring-2 ring-booking-100' : 'border-gray-200'
    )}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
            state === 'complete' ? 'bg-booking-600 text-white' :
            state === 'active' ? 'bg-booking-600 text-white' : 'bg-gray-100 text-gray-400'
          )}>
            {state === 'complete' ? <Check size={13} /> : number}
          </div>
          <div className={cn('text-base font-semibold', state === 'upcoming' ? 'text-gray-400' : 'text-gray-900')}>
            {title}
          </div>
          {state === 'complete' && summary && (
            <span className="text-sm text-gray-500 ml-1">— {summary}</span>
          )}
        </div>
        {state === 'complete' && onEdit && (
          <button onClick={onEdit} className="text-sm font-medium text-booking-600 hover:text-booking-700">Change</button>
        )}
      </div>
      {/* Smoothly expands/collapses via a grid-rows transition instead of
          mounting/unmounting — same pattern used for Add Member's Connect
          to Rooms panel, so this reads as a real accordion, not a hard
          content swap. */}
      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', state === 'active' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className={cn('overflow-hidden transition-opacity duration-200', state === 'active' ? 'opacity-100 delay-100' : 'opacity-0')}>
          <div className="px-5 pb-6 pt-1 border-t border-gray-100 flex flex-col gap-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 1: Reservation ───────────────────────────────────────────────

function ReservationFields({
  locationId, setLocationId, dateMode, setDateMode, selectedDates, setSelectedDates, dates, onContinue,
}: {
  locationId: string; setLocationId: (v: string) => void
  dateMode: DateMode; setDateMode: (v: DateMode) => void
  selectedDates: string[]; setSelectedDates: (v: string[]) => void
  dates: string[]
  onContinue: () => void
}) {
  const selectedLocation = LOCATIONS.find(l => l.id === locationId) ?? LOCATIONS[0]

  return (
    <>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-3">Location</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LOCATIONS.map(loc => {
            const selected = loc.id === locationId
            return (
              <button
                key={loc.id}
                onClick={() => setLocationId(loc.id)}
                className={cn(
                  'text-left rounded-xl border overflow-hidden transition-colors',
                  selected ? 'border-booking-600 ring-2 ring-booking-100 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={loc.photo}
                  alt={loc.name}
                  className="w-full aspect-[16/9] object-cover"
                  style={'photoPosition' in loc ? { objectPosition: loc.photoPosition } : undefined}
                />
                <div className="p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-sm">
                    <span className="font-semibold text-gray-900">{loc.name}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-xs text-gray-500">{loc.phone}</span>
                  </span>
                  <span className={cn(
                    'h-3.5 w-3.5 rounded-full border-[1.5px] flex-shrink-0',
                    selected ? 'border-booking-600 bg-booking-600 ring-2 ring-inset ring-white' : 'border-gray-300'
                  )} />
                </div>
                <div className="text-xs text-gray-400">{loc.address}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Date</div>
        <div className="w-full max-w-[420px]">
          <DayPassDatePicker
            mode={dateMode}
            onModeChange={setDateMode}
            selected={selectedDates}
            onChange={setSelectedDates}
          />
        </div>
      </div>

      {/* Time — broken out as its own section once dates are picked, same
          idea as Industrious's layout: one line per day so a multi-day
          range reads clearly instead of being buried in the date field. */}
      {dates.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Time</div>
          <div className="bg-gray-50 rounded-lg px-3.5 py-3 flex flex-col gap-1.5">
            {dates.map(d => (
              <div key={d} className="flex justify-between text-sm">
                <span className="text-gray-700">{formatDate(new Date(d + 'T12:00:00'), 'EEE, MMM d')}</span>
                <span className="text-gray-500">9:00am – 5:00pm</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Drop in any time during those hours — flat $30/day, no time slot to reserve.
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Need to arrive earlier or stay later than 9am–5pm? {selectedLocation.phone} or{' '}
            <a href="mailto:bookings@bizhaus.com" className="underline hover:text-gray-600">bookings@bizhaus.com</a>.
          </div>
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={dates.length === 0}
        className="self-start bg-booking-600 hover:bg-booking-700 disabled:bg-booking-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-7 rounded-lg transition-colors"
      >
        Continue
      </button>
    </>
  )
}

// ── Section 2: Details + account creation + payment ──────────────────────
//
// Two internal sub-steps, both still inside the "Your Details" accordion
// section: fill in name/email/password → create the account, then the
// actual Stripe card form appears in the same section.

function DetailsAndPayment({
  locationId, locationName, dates, existingCustomer,
  customerId, setCustomerId, clientSecret, setClientSecret,
  guestName, setGuestName, guestEmail, setGuestEmail,
  onSuccess,
}: {
  locationId: string; locationName: string; dates: string[]
  existingCustomer: ExistingCustomer | null
  customerId: string | null; setCustomerId: (v: string) => void
  clientSecret: string | null; setClientSecret: (v: string) => void
  guestName: string; setGuestName: (v: string) => void
  guestEmail: string; setGuestEmail: (v: string) => void
  onSuccess: (confirmationNumber: string) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && password.length >= 8

  // Already signed in — skip account creation entirely and go straight to
  // getting a payment intent for this reservation.
  useEffect(() => {
    if (!existingCustomer || customerId) return
    setCustomerId(existingCustomer.id)
    setGuestName(`${existingCustomer.first_name} ${existingCustomer.last_name}`)
    setGuestEmail(existingCustomer.email)
    fetch('/api/day-pass/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, dates }),
    })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret))
  }, [existingCustomer, customerId, locationId, dates, setCustomerId, setClientSecret, setGuestName, setGuestEmail])

  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    window.location.reload()
  }

  async function handleCreateAccount() {
    setCreatingAccount(true)
    setAccountError(null)

    const res = await fetch('/api/day-pass/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setAccountError(data.error ?? 'Something went wrong creating your account.')
      setCreatingAccount(false)
      return
    }

    setCustomerId(data.customer_id)
    setGuestName(`${firstName.trim()} ${lastName.trim()}`)
    setGuestEmail(email.trim())

    // Creating the account via the admin API (server-side) doesn't log the
    // browser in — sign in explicitly so they're actually authenticated,
    // not just left with an account that exists but no session.
    await createClient().auth.signInWithPassword({ email, password })

    // Now that the account exists, get a payment intent covering every
    // day in the range.
    const piRes = await fetch('/api/day-pass/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, dates }),
    })
    const piData = await piRes.json()
    setClientSecret(piData.clientSecret)
    setCreatingAccount(false)
  }

  // Payment step — only reachable once the account + payment intent exist.
  // Show a confirmed name/email summary here regardless of whether this was
  // an existing login or a signup that just happened — Industrious does the
  // same (locks in "Your details" as read-only right above payment) so the
  // person can see what they're actually booking under before paying.
  if (customerId && clientSecret) {
    return (
      <>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5 -mb-1">
          <div className="flex gap-8 text-sm">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</div>
              <div className="font-medium text-gray-900">{guestName}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</div>
              <div className="font-medium text-gray-900">{guestEmail}</div>
            </div>
          </div>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600 underline">Not you? Sign out</button>
        </div>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentStep
            customerId={customerId}
            locationId={locationId}
            dates={dates}
            guestName={guestName}
            guestEmail={guestEmail}
            onSuccess={onSuccess}
          />
        </Elements>
      </>
    )
  }

  // Signed-in customer, still waiting on the payment intent — don't flash
  // the account-creation form while that fetch is in flight.
  if (existingCustomer) {
    return <div className="text-sm text-gray-400 py-4">Loading payment details…</div>
  }

  return (
    <>
      <div className="flex items-baseline justify-between mt-3">
        <div className="text-sm text-gray-500">We&apos;ll create your BizHaus account at the same time, so you can manage this reservation later.</div>
        <span className="text-sm text-gray-500 whitespace-nowrap ml-4">Have an account? <a href="/day-pass/login" className="font-semibold text-booking-600 hover:text-booking-700">Log in</a></span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First name*</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name*</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email*</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500" />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6 flex flex-col gap-3.5">
        <div>
          <div className="text-base font-semibold text-gray-900 mb-1">Create a password</div>
          <div className="text-sm text-gray-500">Set a password so you can view and manage this reservation.</div>
        </div>
        <div className="max-w-[360px]">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password*</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="text-xs text-gray-400 mt-2 leading-relaxed">Must contain at least 8 characters, upper and lower case letters, and a symbol.</div>
        </div>
      </div>

      {accountError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{accountError}</div>
      )}

      <div className="text-xs text-gray-400 leading-relaxed max-w-[460px]">
        By clicking Continue, I agree to the <a href="#" className="text-booking-600 hover:text-booking-700">Website Terms of Service</a> and the <a href="#" className="text-booking-600 hover:text-booking-700">Privacy Policy</a>.
      </div>

      <button
        onClick={handleCreateAccount}
        disabled={!canSubmit || creatingAccount}
        className="self-start bg-booking-600 hover:bg-booking-700 disabled:bg-booking-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-7 rounded-lg transition-colors"
      >
        {creatingAccount ? 'Creating your account…' : 'Continue to Payment'}
      </button>
    </>
  )
}

// ── Payment sub-step — has access to Stripe hooks via <Elements> ─────────

function PaymentStep({ customerId, locationId, dates, guestName, guestEmail, onSuccess }: {
  customerId: string; locationId: string; dates: string[]
  guestName: string; guestEmail: string
  onSuccess: (confirmationNumber: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<RecaptchaHandle>(null)

  async function handlePay() {
    if (!stripe || !elements) return
    if (!recaptchaToken) { setError('Please complete the "I\'m not a robot" check.'); return }

    setLoading(true)
    setError(null)

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

    const res = await fetch('/api/day-pass/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        location_id: locationId,
        dates,
        guest_name: guestName,
        email: guestEmail,
        stripe_payment_intent_id: paymentIntent.id,
        recaptcha_token: recaptchaToken,
      }),
    })
    const data = await res.json()

    if (res.ok) {
      onSuccess(data.confirmation_number)
    } else {
      setError(data.error ?? 'Payment succeeded but something went wrong saving your reservation. Contact us at hello@bizhaus.com.')
      recaptchaRef.current?.reset()
      setLoading(false)
    }
  }

  const total = DAY_PASS_PRICE * dates.length

  return (
    <div className="flex flex-col gap-5 mt-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Payment</label>
        <PaymentElement />
      </div>

      <Recaptcha ref={recaptchaRef} onChange={setRecaptchaToken} />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      <button
        onClick={handlePay}
        disabled={loading || !stripe || !recaptchaToken}
        className={cn(
          'self-start text-white text-sm font-semibold py-3 px-7 rounded-lg transition-colors',
          loading || !stripe || !recaptchaToken ? 'bg-booking-300 cursor-not-allowed' : 'bg-booking-600 hover:bg-booking-700'
        )}
      >
        {loading ? 'Processing…' : `Pay $${total}.00 & Complete Reservation`}
      </button>
    </div>
  )
}

function StepConfirmation({ loc, dates, guestName, confirmationNumber, onRestart }: {
  loc: typeof LOCATIONS[number]; dates: string[]
  guestName: string; confirmationNumber: string
  onRestart: () => void
}) {
  const total = DAY_PASS_PRICE * dates.length
  const dateRangeLabel = dates.length > 1
    ? `${dates.length} days (${formatDate(new Date(dates[0] + 'T12:00:00'), 'MMM d')} – ${formatDate(new Date(dates[dates.length - 1] + 'T12:00:00'), 'MMM d, yyyy')})`
    : dates[0] ? formatDate(new Date(dates[0] + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''

  return (
    <div className="max-w-lg mx-auto text-center flex flex-col items-center gap-6 py-12">
      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircle size={28} className="text-green-600" />
      </div>

      <div>
        <div className="text-2xl font-bold text-gray-900 mb-1.5">You&apos;re all set{guestName ? `, ${guestName.split(' ')[0]}` : ''}!</div>
        <div className="text-sm text-gray-500">Your day pass{dates.length > 1 ? 'es are' : ' is'} reserved for {dateRangeLabel} at {loc.name}.</div>
      </div>

      <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm text-left overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-baseline">
          <div className="text-[15px] font-semibold text-gray-900">Coworking Day Pass{dates.length > 1 ? 'es' : ''}</div>
          <div className="text-xs text-gray-400">#{confirmationNumber}</div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2.5">
          {dates.map(d => (
            <div key={d} className="flex justify-between text-sm">
              <span className="text-gray-500">{formatDate(new Date(d + 'T12:00:00'), 'EEE, MMM d')}</span>
              <span className="font-medium text-gray-900">9:00am – 5:00pm PDT</span>
            </div>
          ))}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Location</span>
            <span className="font-medium text-gray-900">{loc.name}</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 -mx-3 py-2.5 flex justify-between text-sm font-semibold text-gray-900 mt-1">
            <span>Total paid</span>
            <span>${total}.00</span>
          </div>
        </div>
      </div>

      <div className="w-full text-left">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3.5">What&apos;s next</div>
        <div className="flex flex-col gap-3.5">
          {[
            "We've emailed a confirmation and receipt to you.",
            'Arrive any time during business hours, 9:00am–5:00pm.',
            'Check in with the front desk using your name or this confirmation.',
          ].map(text => (
            <div key={text} className="flex gap-2.5 items-start">
              <div className="w-6 h-6 rounded-full bg-green-50 flex-shrink-0 flex items-center justify-center mt-0.5">
                <CheckCircle size={12} className="text-green-600" />
              </div>
              <div className="text-sm text-gray-700 leading-relaxed pt-0.5">{text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 items-center mt-2">
        <button onClick={onRestart} className="bg-booking-600 hover:bg-booking-700 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors">
          Book Another Day Pass
        </button>
        <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-700">Return to bizhaus.com</a>
      </div>
    </div>
  )
}

function PriceSummary({ days }: { days: number }) {
  const n = Math.max(days, 1)
  const total = DAY_PASS_PRICE * n
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">Coworking Day Pass</div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2.5">
          <div className="flex justify-between text-sm text-gray-700">
            <span>${DAY_PASS_PRICE} / day{days > 1 ? ` × ${days} days` : ''}</span>
            <span>${total}.00</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 -mx-3 py-2.5 flex justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>${total}.00</span>
          </div>
        </div>
      </div>
    </div>
  )
}
