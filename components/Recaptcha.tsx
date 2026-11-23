'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useId } from 'react'
import Script from 'next/script'
import { recaptchaDisabled, RECAPTCHA_DISABLED_TOKEN } from '@/lib/recaptchaDisabled'

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: string | HTMLElement, params: Record<string, unknown>) => number
      reset: (widgetId?: number) => void
    }
    // Deliberately no onRecaptchaApiLoad: see the render effect below.
  }
}

type Props = {
  onChange: (token: string | null) => void
}

export type RecaptchaHandle = {
  // Call this after ANY failed submission — a v2 token is single-use, so if
  // the form fails for an unrelated reason (bad password, server error,
  // etc.) the old token is now dead and must not be resubmitted.
  reset: () => void
}

// Google reCAPTCHA v2 "I'm not a robot" checkbox, rendered explicitly once
// the script has loaded (avoids relying on the auto-render div, which is
// unreliable with React's render cycle).
const Recaptcha = forwardRef<RecaptchaHandle, Props>(function Recaptcha({ onChange }, ref) {
  const containerId = `recaptcha-${useId().replace(/[:]/g, '')}`
  const widgetId = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetId.current)
      }
      // When the check is off, a reset has to hand the stand-in token back,
      // not null — otherwise the first failed submission (wrong password,
      // say) leaves the form permanently unsubmittable.
      onChangeRef.current(recaptchaDisabled ? RECAPTCHA_DISABLED_TOKEN : null)
    },
  }), [])

  // Turned off on staging and local dev: hand the form a stand-in token so
  // it submits, and say on screen that this is not how production behaves.
  // Doing it here rather than in each of the four forms keeps the widget and
  // the server check reading the same flag.
  useEffect(() => {
    if (recaptchaDisabled) onChangeRef.current(RECAPTCHA_DISABLED_TOKEN)
  }, [])

  // Waits for Google's script by looking, rather than by being called back.
  //
  // This used to park its render function on window.onRecaptchaApiLoad, the
  // single global the script's onload calls. That works for one box on a
  // page and quietly fails for two: the second one to mount overwrites the
  // first, the script calls the global once, and only the last box ever
  // gets drawn. /book asks for two, so the one in the account details has
  // never appeared, which left every new customer with a check they could
  // not tick and a button that would not go (Caroline spotted the missing
  // box, 2026-11-23).
  //
  // Polling has no shared state, so any number of boxes on a page each
  // render themselves.
  useEffect(() => {
    if (recaptchaDisabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    function tryRender() {
      if (cancelled || widgetId.current !== null) return
      const el = document.getElementById(containerId)
      // children.length guards against a double render into one container,
      // which grecaptcha rejects outright.
      if (window.grecaptcha?.render && el && el.children.length === 0) {
        widgetId.current = window.grecaptcha.render(el, {
          sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          callback: (token: string) => onChangeRef.current(token),
          'expired-callback': () => onChangeRef.current(null),
          'error-callback': () => onChangeRef.current(null),
        })
        return
      }
      timer = setTimeout(tryRender, 150)
    }

    tryRender()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [containerId])

  if (recaptchaDisabled) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        &ldquo;I&rsquo;m not a robot&rdquo; is turned off here so this form can be tested.
        It is on in production.
      </p>
    )
  }

  return (
    <>
      <Script
        // No onload callback: each box watches for grecaptcha itself, so
        // there is no single global for a second box to overwrite.
        src="https://www.google.com/recaptcha/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div id={containerId} />
    </>
  )
})

export default Recaptcha
