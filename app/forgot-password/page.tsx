'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Shared by member-portal login and day-pass/book login — both are real
// Supabase Auth users under the hood, this page just needs to know which
// login to send someone back to. `context=day-pass` is passed in by
// /day-pass/login's "Forgot password?" link and threaded through to
// /auth/reset-password too, so the whole reset trip sends a booking
// customer back to /day-pass/login, not the member portal's /login —
// before this (2026-08-31) there was no way back in for a booking
// customer who forgot their password at all.
//
// Wrapped in Suspense — useSearchParams() requires it for static
// prerendering, otherwise the build fails on this page entirely.
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <ForgotPasswordForm />
    </Suspense>
  )
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const isDayPass = searchParams.get('context') === 'day-pass'
  const backToSignIn = isDayPass ? '/day-pass/login' : '/login'

  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const redirectPath = isDayPass ? '/auth/reset-password?context=day-pass' : '/auth/reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${redirectPath}`,
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  const accent = isDayPass ? 'bg-booking-600 hover:bg-booking-700 focus:ring-booking-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
  const linkAccent = isDayPass ? 'text-booking-600 hover:text-booking-700' : 'text-blue-600 hover:text-blue-800'

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDayPass ? 'bg-gray-50' : 'bg-slate-900'}`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold tracking-tight ${isDayPass ? 'text-gray-900' : 'text-white'}`}>
            BizHaus <span className="font-medium">{isDayPass ? 'Day Pass' : 'Portal'}</span>
          </h1>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✉️</div>
              <h2 className="font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link.
              </p>
              <Link href={backToSignIn} className={`block text-sm mt-4 ${linkAccent}`}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${isDayPass ? 'focus:ring-booking-500' : 'focus:ring-blue-500'}`}
                    placeholder="you@example.com" autoFocus />
                </div>
                <button type="submit" disabled={loading}
                  className={`w-full disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors ${accent}`}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <Link href={backToSignIn} className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-4">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
