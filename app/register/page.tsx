'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PasswordInput from '@/components/PasswordInput'
import Recaptcha, { RecaptchaHandle } from '@/components/Recaptcha'
import { ArrowLeft } from 'lucide-react'
import { getSeatingOptions } from '@/lib/seating'
import { createClient } from '@/lib/supabase/client'
import { passwordError, PASSWORD_REQUIREMENTS_TEXT } from '@/lib/password'
import { JUST_SIGNED_UP_KEY } from '@/lib/utils'

type Location = { id: string; name: string }

type FoundInvite = {
  email: string
  defaultLocationId: string | null
  firstName: string | null
  lastName: string | null
  seating: string | null
}

function EmailStep({ onFound }: { onFound: (invite: FoundInvite) => void }) {
  const [email, setEmail] = useState('')
  const [checking, setChecking] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setNotFound(false)
    setAlreadyRegistered(false)
    const res = await fetch('/api/invites/lookup-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (data.status === 'ok') {
      onFound({
        email:             data.email,
        defaultLocationId: data.default_location_id ?? null,
        firstName:         data.first_name ?? null,
        lastName:          data.last_name ?? null,
        seating:           data.seating ?? null,
      })
    }
    else if (data.status === 'already_registered') setAlreadyRegistered(true)
    else setNotFound(true)
    setChecking(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={14} /> Back to sign in
      </Link>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Register your account</h2>
      <p className="text-sm text-gray-500 mb-6">Enter the email your BizHaus membership is under.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com" />
        </div>
        {notFound && (
          <p className="text-sm text-red-600">This email isn't recognized yet. Contact your admin to get added.</p>
        )}
        {alreadyRegistered && (
          <p className="text-sm text-red-600">
            This email already has an account. <Link href="/login" className="underline">Sign in instead</Link>.
          </p>
        )}
        <button type="submit" disabled={checking}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
      <p className="text-center text-gray-400 text-xs mt-6">
        Already have an account? <Link href="/login" className="text-blue-600 hover:text-blue-800">Sign in</Link>
      </p>
    </div>
  )
}

function DetailsStep({ email, defaultLocationId, defaultFirstName, defaultLastName, defaultSeating }: {
  email: string
  defaultLocationId: string | null
  defaultFirstName: string | null
  defaultLastName: string | null
  defaultSeating: string | null
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(defaultFirstName ?? '')
  const [lastName, setLastName]   = useState(defaultLastName ?? '')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [locationId, setLocationId] = useState(defaultLocationId ?? '')
  const [locations, setLocations] = useState<Location[]>([])
  const [seating, setSeating] = useState('')
  const [loading, setLoading]     = useState(false)
  // Missing entirely from this flow until now — /setup-account (the
  // invite-link path) has always required this, but this self-serve
  // "look up my email" path was built separately and never got it added.
  // Nothing else here rate-limits or bot-checks account creation. Caught
  // 2026-09-11 during an audit prompted by the room-access bug.
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<RecaptchaHandle>(null)

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then((data: Location[]) => {
        setLocations(data)
        if (data.length > 0) setLocationId(prev => prev || data[0].id)
      })
  }, [])

  // Seating options depend on the selected location — but this no longer
  // auto-picks anything, including the admin's own preset (defaultSeating).
  // That auto-fill meant someone could finish signup without ever actually
  // looking at this field, silently locking in whatever an admin happened
  // to type when adding them — caught 2026-09-11 when a member's Faces
  // card showed a seating spot she'd never chosen. Only job left here: if
  // the location changes and the seating picked so far no longer belongs
  // to the new location's options, clear it back to blank. defaultSeating
  // is still shown as a hint below the field (see the label below) so the
  // admin's preset isn't lost information — the member just has to
  // actually pick it (or something else) themselves.
  useEffect(() => {
    if (locations.length === 0) return
    const opts = getSeatingOptions(locations.find(l => l.id === locationId)?.name)
    setSeating(prev => (opts.includes(prev) ? prev : ''))
  }, [locationId, locations])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { toast.error('Passwords do not match'); return }
    const pwErr = passwordError(password)
    if (pwErr) { toast.error(pwErr); return }
    if (!locationId)             { toast.error('Please select a default location'); return }
    if (!seating)                { toast.error('Please select where you sit'); return }
    if (!recaptchaToken)         { toast.error('Please complete the "I\'m not a robot" check'); return }
    setLoading(true)
    const res = await fetch('/api/invites/accept-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, first_name: firstName.trim(), last_name: lastName.trim(), password, default_location_id: locationId, seating: seating || null, recaptcha_token: recaptchaToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Something went wrong')
      // Single-use token — reset so a retry gets a fresh one instead of
      // silently failing on resubmit, same as /setup-account.
      recaptchaRef.current?.reset()
      setLoading(false)
    } else {
      // Account was just created server-side (via the service role), so the
      // browser has no session yet. Sign in right away with the same
      // credentials instead of bouncing them to a login page to retype what
      // they just entered.
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        toast.success('Account created! Please sign in.')
        router.push('/login')
        return
      }
      toast.success('Account created!')
      try { sessionStorage.setItem(JUST_SIGNED_UP_KEY, '1') } catch (_) {}
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={14} /> Back to sign in
      </Link>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Set up your account</h2>
      <p className="text-sm text-gray-500 mb-6">Creating account for <strong>{email}</strong></p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Smith" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <PasswordInput value={password} onChange={setPassword} required autoComplete="new-password" placeholder="At least 8 characters" />
          <p className="text-xs text-gray-400 mt-1">{PASSWORD_REQUIREMENTS_TEXT}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <PasswordInput value={password2} onChange={setPassword2} required autoComplete="new-password" placeholder="Repeat password" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Location</label>
          <p className="text-xs text-gray-400 mb-1.5">This will be your default location in Rooms.</p>
          {/* Disabled with a placeholder while locations are still loading
              — rendering the real <select> against an empty locations list
              used to show "Loading..." as the only option, and once the
              real list arrived a split second later, the browser had
              already visually settled on it, so the admin's preset
              location/seating never appeared to "take" even though the
              state itself would update correctly right after. */}
          {locations.length === 0 ? (
            <select disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
              <option>Loading…</option>
            </select>
          ) : (
            <select required value={locationId} onChange={e => setLocationId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Where do you sit?</label>
          <p className="text-xs text-gray-400 mb-1.5">
            Shown below your name on Faces.
            {defaultSeating && defaultSeating !== seating && (
              <> Your admin has this on file as <strong className="font-medium text-gray-500">{defaultSeating}</strong> — pick it below if that's still right.</>
            )}
          </p>
          {locations.length === 0 ? (
            <select disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
              <option>Loading…</option>
            </select>
          ) : (
            <select required value={seating} onChange={e => setSeating(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="" disabled>Select where you sit…</option>
              {getSeatingOptions(locations.find(l => l.id === locationId)?.name).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div className="flex justify-center">
          <Recaptcha ref={recaptchaRef} onChange={setRecaptchaToken} />
        </div>
        <button type="submit" disabled={loading || !recaptchaToken}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}

export default function RegisterPage() {
  const [invite, setInvite] = useState<FoundInvite | null>(null)

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bizhaus-logo-white.png" alt="BizHaus" className="h-8 w-auto" />
          <span className="text-lg font-semibold text-white">Portal</span>
        </div>
        {invite
          ? <DetailsStep
              email={invite.email}
              defaultLocationId={invite.defaultLocationId}
              defaultFirstName={invite.firstName}
              defaultLastName={invite.lastName}
              defaultSeating={invite.seating}
            />
          : <EmailStep onFound={setInvite} />}
      </div>
    </div>
  )
}
