'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { passwordError, PASSWORD_REQUIREMENTS_TEXT } from '@/lib/password'

// `context=day-pass` is threaded through from /forgot-password's
// redirectTo — see that file for why. Determines where "Update Password"
// sends someone afterward: a booking customer back to /my-bookings/login,
// a member back to /login.
//
// Wrapped in Suspense — useSearchParams() requires it for static
// prerendering, otherwise the build fails on this page entirely.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router  = useRouter()
  const searchParams = useSearchParams()
  const isDayPass = searchParams.get('context') === 'day-pass'
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [ready, setReady]         = useState(false)
  const [failed, setFailed]       = useState<string | null>(null)

  // Turning a reset link into a signed-in session. Supabase can hand the
  // link back in three different shapes and this page used to understand
  // only one of them, so it sat on "Verifying reset link…" forever with no
  // error (Caroline, 2026-09-30):
  //
  //   ?code=…        PKCE. What we actually get, because lib/supabase/client
  //                  uses createBrowserClient, which is PKCE by default.
  //                  Needs exchangeCodeForSession, which nothing called.
  //   ?token_hash=…  The browser-independent recovery link.
  //   #access_token= The old implicit flow; the client picks this up itself.
  //
  // Whatever happens, this now finishes: any failure shows a real message
  // with a way to ask for a fresh link, and a backstop timer means it can
  // never hang silently again.
  useEffect(() => {
    const supabase = createClient()
    let settled = false
    const succeed = () => { if (!settled) { settled = true; setReady(true) } }
    const fail = (msg: string) => { if (!settled) { settled = true; setFailed(msg) } }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') succeed()
    })

    const EXPIRED = 'This reset link has expired or has already been used.'

    ;(async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const param = (k: string) => searchParams.get(k) ?? hash.get(k)

      // Supabase sometimes redirects back with an error instead of a token.
      const errorDescription = param('error_description') ?? param('error')
      if (errorDescription) return fail(EXPIRED)

      const { data: { session } } = await supabase.auth.getSession()
      if (session) return succeed()

      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        // PKCE keeps half the handshake in the browser that asked for the
        // reset, so opening the link on a different device fails here even
        // though the link itself is perfectly good.
        return error
          ? fail('This link has to be opened in the same browser you requested it from, or it has expired.')
          : succeed()
      }

      const tokenHash = param('token_hash')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        return error ? fail(EXPIRED) : succeed()
      }

      // Implicit flow: the client reads the hash itself, so give it a moment.
      if (hash.get('access_token')) {
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession()
          if (s) succeed(); else fail(EXPIRED)
        }, 1000)
        return
      }

      fail('This page needs a password reset link to work.')
    })()

    // Backstop: never leave someone staring at "Verifying…".
    const timer = setTimeout(() => fail(EXPIRED), 10000)

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    const pwErr = passwordError(password)
    if (pwErr) { toast.error(pwErr); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Password updated! Please sign in.')
      router.push(isDayPass ? '/my-bookings/login' : '/login')
    }
  }

  if (failed) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDayPass ? 'bg-gray-50' : 'bg-slate-900'}`}>
        <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">We couldn&apos;t open that link</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">{failed}</p>
          <a
            href={isDayPass ? '/forgot-password?context=day-pass' : '/forgot-password'}
            className={`inline-block w-full font-semibold py-2 px-4 rounded-lg text-white transition-colors ${
              isDayPass ? 'bg-booking-600 hover:bg-booking-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Send me a new link
          </a>
          <a
            href={isDayPass ? '/my-bookings/login' : '/login'}
            className="block mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDayPass ? 'bg-gray-50' : 'bg-slate-900'}`}>
        <p className={isDayPass ? 'text-gray-400' : 'text-slate-400'}>Verifying reset link…</p>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDayPass ? 'bg-gray-50' : 'bg-slate-900'}`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold tracking-tight ${isDayPass ? 'text-gray-900' : 'text-white'}`}>
            BizHaus <span className="font-medium">{isDayPass ? 'Bookings' : 'Portal'}</span>
          </h1>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Set new password</h2>
          <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{PASSWORD_REQUIREMENTS_TEXT}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input type={showConf ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
