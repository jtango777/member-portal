'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, Eye, EyeOff, CheckCircle } from 'lucide-react'
import MiniDatePicker from '@/components/MiniDatePicker'
import { cn } from '@/lib/utils'

// Front-end flow only for now — no Stripe checkout or database write yet.
// Locations are hardcoded here rather than fetched; wire these up to the
// real `locations` table once this becomes a real booking flow.
const LOCATIONS = [
  { name: 'El Segundo', phone: '(310) 870-1730', address: '[street address — El Segundo]' },
  { name: 'Marina del Rey', phone: '(310) 596-1990', address: '[street address — Marina del Rey]' },
  { name: 'Costa Mesa', phone: '(949) 800-8660', address: '[street address — Costa Mesa]' },
] as const

const DAY_PASS_PRICE = 30

type Step = 1 | 2 | 3 | 4

export default function DayPassPage() {
  const [step, setStep] = useState<Step>(1)
  const [location, setLocation] = useState<string>('El Segundo')
  const [date, setDate] = useState<string>('2026-08-19')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const selectedLocation = LOCATIONS.find(l => l.name === location) ?? LOCATIONS[0]
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  function restart() {
    setStep(1)
    setLocation('El Segundo')
    setFirstName(''); setLastName(''); setEmail(''); setPassword('')
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {step > 1 && step < 4 && (
        <button
          onClick={() => setStep(s => (s - 1) as Step)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <ChevronLeft size={15} /> Back
        </button>
      )}

      {step < 4 ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 min-w-0 flex flex-col gap-8">

            {step === 1 && (
              <StepLocationDate
                location={location} setLocation={setLocation}
                date={date} setDate={setDate}
                onContinue={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <StepReview
                loc={selectedLocation} formattedDate={formattedDate}
                onChangeLocation={() => setStep(1)}
                onChangeDate={() => setStep(1)}
                onContinue={() => setStep(3)}
              />
            )}

            {step === 3 && (
              <StepDetails
                firstName={firstName} setFirstName={setFirstName}
                lastName={lastName} setLastName={setLastName}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                showPassword={showPassword} setShowPassword={setShowPassword}
                onSubmit={() => setStep(4)}
              />
            )}
          </div>

          <div className="lg:col-span-2 sticky top-20">
            <PriceSummary />
          </div>
        </div>
      ) : (
        <StepConfirmation loc={selectedLocation} formattedDate={formattedDate} onRestart={restart} />
      )}
    </div>
  )
}

function StepLocationDate({ location, setLocation, date, setDate, onContinue }: {
  location: string; setLocation: (v: string) => void
  date: string; setDate: (v: string) => void
  onContinue: () => void
}) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1.5">Reserve a Day Pass</h1>
        <p className="text-sm text-gray-500">Choose a location and date to get started.</p>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Location</div>
        <div className="grid grid-cols-3 gap-3">
          {LOCATIONS.map(loc => {
            const selected = loc.name === location
            return (
              <button
                key={loc.name}
                onClick={() => setLocation(loc.name)}
                className={cn(
                  'text-left rounded-xl p-4 border transition-colors',
                  selected ? 'border-blue-600 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{loc.name}</span>
                  <span className={cn(
                    'h-3.5 w-3.5 rounded-full border-[1.5px] flex-shrink-0',
                    selected ? 'border-blue-600 bg-blue-600 ring-2 ring-inset ring-white' : 'border-gray-300'
                  )} />
                </div>
                <div className="text-xs text-gray-500 mb-0.5">{loc.phone}</div>
                <div className="text-xs text-gray-400">{loc.address}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Date</div>
        <div className="w-[280px] flex items-center gap-2.5 border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm">
          <Calendar size={16} className="text-gray-500 flex-shrink-0" />
          <div className="flex-1">
            <MiniDatePicker value={date} onChange={setDate} />
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2">Day passes are available Monday–Friday, 9:00am–5:00pm.</div>
      </div>

      <button
        onClick={onContinue}
        className="self-start bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 px-7 rounded-lg transition-colors"
      >
        Continue
      </button>
    </>
  )
}

function StepReview({ loc, formattedDate, onChangeLocation, onChangeDate, onContinue }: {
  loc: typeof LOCATIONS[number]; formattedDate: string
  onChangeLocation: () => void; onChangeDate: () => void
  onContinue: () => void
}) {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">Your Reservation</h1>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</div>
          <button onClick={onChangeDate} className="text-sm font-medium text-blue-600 hover:text-blue-700">Change</button>
        </div>
        <div className="text-[15px] font-medium text-gray-900">{formattedDate}</div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Time</div>
        <div className="text-sm text-gray-500 mb-0.5">You&apos;ll have building access during business hours</div>
        <div className="text-[15px] font-medium text-gray-900">9:00am – 5:00pm PDT</div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</div>
          <button onClick={onChangeLocation} className="text-sm font-medium text-blue-600 hover:text-blue-700">Change</button>
        </div>
        <div className="text-[15px] font-medium text-gray-900 mb-1">{loc.name}</div>
        <div className="text-sm text-gray-400 leading-relaxed mb-2">{loc.address}</div>
        <div className="flex gap-4">
          <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">View Location</a>
          <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">Get Directions</a>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 leading-relaxed">
        Reservations may be canceled for a full refund until 12:00am (midnight) the night before your reservation date.
      </div>

      <button
        onClick={onContinue}
        className="self-start bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 px-7 rounded-lg transition-colors"
      >
        Continue
      </button>
    </>
  )
}

function StepDetails({ firstName, setFirstName, lastName, setLastName, email, setEmail, password, setPassword, showPassword, setShowPassword, onSubmit }: {
  firstName: string; setFirstName: (v: string) => void
  lastName: string; setLastName: (v: string) => void
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  showPassword: boolean; setShowPassword: (v: boolean) => void
  onSubmit: () => void
}) {
  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && password.length >= 8

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="text-[26px] font-bold text-gray-900">Your details</h1>
        <span className="text-sm text-gray-500">Have an account? <a href="/login" className="font-semibold text-blue-600 hover:text-blue-700">Log in</a></span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First name*</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name*</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email*</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="text-xs text-gray-400 mt-2 leading-relaxed">Must contain at least 8 characters, upper and lower case letters, and a symbol.</div>
        </div>
      </div>

      <div className="text-xs text-gray-400 leading-relaxed max-w-[460px]">
        By clicking Complete Reservation, I agree to the <a href="#" className="text-blue-600 hover:text-blue-700">Website Terms of Service</a> and the <a href="#" className="text-blue-600 hover:text-blue-700">Privacy Policy</a>.
      </div>

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="self-start bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-7 rounded-lg transition-colors"
      >
        Complete Reservation
      </button>
    </>
  )
}

function StepConfirmation({ loc, formattedDate, onRestart }: {
  loc: typeof LOCATIONS[number]; formattedDate: string; onRestart: () => void
}) {
  return (
    <div className="max-w-lg mx-auto text-center flex flex-col items-center gap-6 py-12">
      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircle size={28} className="text-green-600" />
      </div>

      <div>
        <div className="text-2xl font-bold text-gray-900 mb-1.5">You&apos;re all set!</div>
        <div className="text-sm text-gray-500">Your day pass is reserved for {formattedDate} at {loc.name}.</div>
      </div>

      <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm text-left overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-baseline">
          <div className="text-[15px] font-semibold text-gray-900">Coworking Day Pass</div>
          <div className="text-xs text-gray-400">#BH-DP-{Math.floor(100000 + Math.random() * 900000)}</div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">{formattedDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Time</span>
            <span className="font-medium text-gray-900">9:00am – 5:00pm PDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Location</span>
            <span className="font-medium text-gray-900">{loc.name}</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex justify-between text-sm font-semibold text-gray-900 mt-1">
            <span>Total paid</span>
            <span>${DAY_PASS_PRICE}.00</span>
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
        <button onClick={onRestart} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors">
          Book Another Day Pass
        </button>
        <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-700">Return to bizhaus.com</a>
      </div>
    </div>
  )
}

function PriceSummary() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <div className="text-sm font-semibold text-amber-800 mb-0.5">Flexible cancellation</div>
        <div className="text-sm text-amber-700 leading-relaxed">Full refund if canceled before midnight the night before your reservation.</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">Coworking Day Pass</div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2.5 border-b border-gray-100">
          <div className="flex justify-between text-sm text-gray-700">
            <span>${DAY_PASS_PRICE} / day</span>
            <span>${DAY_PASS_PRICE}.00</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>${DAY_PASS_PRICE}.00</span>
          </div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input placeholder="Promo code" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors">Apply</button>
          </div>
          <div className="text-xs text-gray-400">Promo codes can be applied after logging in.</div>
        </div>
      </div>
    </div>
  )
}
