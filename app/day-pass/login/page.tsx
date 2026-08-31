'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import PasswordInput from '@/components/PasswordInput'

export default function DayPassLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Incorrect email or password.')
      setLoading(false)
      return
    }
    router.push('/day-pass/account')
    router.refresh()
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
      <p className="text-sm text-gray-500 mb-8">View and manage your day pass reservations.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-booking-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <a href="/forgot-password?context=day-pass" className="text-xs text-booking-600 hover:text-booking-700 font-medium">Forgot password?</a>
          </div>
          <PasswordInput value={password} onChange={setPassword} required autoComplete="current-password" />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-booking-600 hover:bg-booking-700 disabled:bg-booking-300 text-white text-sm font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-6 text-center">
        Don&apos;t have an account? <a href="/day-pass" className="text-booking-600 hover:text-booking-700 font-medium">Reserve a day pass</a> to create one.
      </p>
    </div>
  )
}
