'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PasswordInput from '@/components/PasswordInput'
import { ArrowLeft } from 'lucide-react'
import { getSeatingOptions } from '@/lib/seating'
import { createClient } from '@/lib/supabase/client'

type Location = { id: string; name: string }

function EmailStep({ onFound }: { onFound: (email: string, defaultLocationId: string | null) => void }) {
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
    if (data.status === 'ok') onFound(data.email, data.default_location_id ?? null)
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

function DetailsStep({ email, defaultLocationId }: { email: string; defaultLocationId: string | null }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [locationId, setLocationId] = useState(defaultLocationId ?? '')
  const [locations, setLocations] = useState<Location[]>([])
  const [seating, setSeating] = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then((data: Location[]) => {
        setLocations(data)
        if (data.length > 0) setLocationId(prev => prev || data[0].id)
      })
  }, [])

  // Seating options depend on the selected location — keep a valid default
  // selected (instead of a blank "Prefer not to say") whenever the location
  // changes, so the field is never accidentally empty once required.
  useEffect(() => {
    const opts = getSeatingOptions(locations.find(l => l.id === locationId)?.name)
    setSeating(prev => opts.includes(prev) ? prev : (opts[0] ?? ''))
  }, [locationId, locations])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { toast.error('Passwords do not match'); return }
    if (password.length < 8)    { toast.error('Password must be at least 8 characters'); return }
    if (!locationId)             { toast.error('Please select a default location'); return }
    if (!seating)                { toast.error('Please select where you sit'); return }
    setLoading(true)
    const res = await fetch('/api/invites/accept-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, first_name: firstName.trim(), last_name: lastName.trim(), password, default_location_id: locationId, seating: seating || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Something went wrong')
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Where do you sit?</label>
          <p className="text-xs text-gray-400 mb-1.5">Shown below your name on Faces.</p>
          <select required value={seating} onChange={e => setSeating(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {getSeatingOptions(locations.find(l => l.id === locationId)?.name).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}

export default function RegisterPage() {
  const [foundEmail, setFoundEmail] = useState<string | null>(null)
  const [foundLocationId, setFoundLocationId] = useState<string | null>(null)

  function handleFound(email: string, defaultLocationId: string | null) {
    setFoundEmail(email)
    setFoundLocationId(defaultLocationId)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bizhaus-logo-white.png" alt="BizHaus" className="h-8 w-auto" />
          <span className="text-lg font-semibold text-white">Portal</span>
        </div>
        {foundEmail
          ? <DetailsStep email={foundEmail} defaultLocationId={foundLocationId} />
          : <EmailStep onFound={handleFound} />}
      </div>
    </div>
  )
}
