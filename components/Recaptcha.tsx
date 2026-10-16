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
    onRecaptchaApiLoad?: () => void
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

  useEffect(() => {
    if (recaptchaDisabled) return
    function render() {
      if (widgetId.current !== null) return
      if (!window.grecaptcha || !document.getElementById(containerId)) return
      widgetId.current = window.grecaptcha.render(containerId, {
        sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
        callback: (token: string) => onChangeRef.current(token),
        'expired-callback': () => onChangeRef.current(null),
        'error-callback': () => onChangeRef.current(null),
      })
    }

    if (window.grecaptcha) render()
    else window.onRecaptchaApiLoad = render

    return () => { window.onRecaptchaApiLoad = undefined }
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
        src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaApiLoad&render=explicit"
        strategy="afterInteractive"
      />
      <div id={containerId} />
    </>
  )
})

export default Recaptcha
