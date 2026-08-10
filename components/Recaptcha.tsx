'use client'

import { useEffect, useRef, useId } from 'react'
import Script from 'next/script'

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

// Google reCAPTCHA v2 "I'm not a robot" checkbox, rendered explicitly once
// the script has loaded (avoids relying on the auto-render div, which is
// unreliable with React's render cycle).
export default function Recaptcha({ onChange }: Props) {
  const containerId = `recaptcha-${useId().replace(/[:]/g, '')}`
  const widgetId = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
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

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaApiLoad&render=explicit"
        strategy="afterInteractive"
      />
      <div id={containerId} />
    </>
  )
}
