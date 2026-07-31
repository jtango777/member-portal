'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">BizHaus</h1>
          <p className="text-slate-400 mt-2 text-sm">Member Portal</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✉️</div>
              <h2 className="font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link.
              </p>
              <Link href="/login" className="block text-sm text-blue-600 hover:text-blue-800 mt-4">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com" autoFocus />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-4">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
