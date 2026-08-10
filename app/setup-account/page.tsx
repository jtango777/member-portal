'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import PasswordInput from '@/components/PasswordInput'
import Recaptcha, { RecaptchaHandle } from '@/components/Recaptcha'
import { createClient } from '@/lib/supabase/client'

type Location = { id: string; name: string }

function SetupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [name, setName]           = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading]     = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [email, setEmail]         = useState('')
  const [invitedLocationId, setInvitedLocationId] = useState<string | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<RecaptchaHandle>(null)

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    fetch(`/api/invites/verify?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true)
          setEmail(data.email)
          setInvitedLocationId(data.default_location_id ?? null)
        } else setTokenValid(false)
      })
      .catch(() => setTokenValid(false))

    // Fetch locations for the dropdown
    fetch('/api/locations')
      .then(r => r.json())
      .then((data: Location[]) => {
        setLocations(data)
        if (data.length > 0) setLocationId(prev => prev || data[0].id)
      })
  }, [token])

  // Once we know the invite's assigned location, prefer it over whatever
  // was already selected (e.g. the /api/locations fallback that may have
  // resolved first) — this is the location an admin deliberately set for
  // this member, not just whichever location happened to load first.
  useEffect(() => {
    if (invitedLocationId) setLocationId(invitedLocationId)
  }, [invitedLocationId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { toast.error('Passwords do not match'); return }
    if (password.length < 8)    { toast.error('Password must be at least 8 characters'); return }
    if (!locationId)             { toast.error('Please select a default location'); return }
    if (!recaptchaToken)         { toast.error('Please complete the "I\'m not a robot" check'); return }
    setLoading(true)
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, password, default_location_id: locationId, recaptcha_token: recaptchaToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Something went wrong')
      // The reCAPTCHA token is single-use — even though signup failed for an
      // unrelated reason, Google may have already consumed it. Reset so the
      // retry gets a fresh one instead of silently failing on resubmit.
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
      router.push('/dashboard')
      router.refresh()
    }
  }

  if (tokenValid === null) {
    return <div className="text-center text-slate-400">Verifying your invite…</div>
  }

  if (!tokenValid) {
    return (
      <div className="text-center">
        <p className="text-red-400 font-medium">This invite link is invalid or has already been used.</p>
        <p className="text-slate-400 text-sm mt-2">Contact your admin to receive a new invite.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Set up your account</h2>
      <p className="text-sm text-gray-500 mb-6">Creating account for <strong>{email}</strong></p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Jane Smith" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <PasswordInput value={password} onChange={setPassword} required autoComplete="new-password" placeholder="At least 8 characters" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <PasswordInput value={password2} onChange={setPassword2} required autoComplete="new-password" placeholder="Repeat password" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Location</label>
          <p className="text-xs text-gray-400 mb-1.5">This will be your default location in Rooms.</p>
          <select required value={locationId} onChange={e => setLocationId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
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

export default function SetupAccountPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">BizHaus <span className="font-medium">Portal</span></h1>
        </div>
        <Suspense fallback={<div className="text-center text-slate-400">Loading…</div>}>
          <SetupForm />
        </Suspense>
      </div>
    </div>
  )
}
