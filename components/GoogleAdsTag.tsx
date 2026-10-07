'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

// Google Ads conversion tracking for the customer-facing booking site
// (Chris, 2026-10-07).
//
// Deliberately not in the root layout unconditionally. One Next app serves
// both bookings.bizhaus.com and members.bizhaus.com, so an unscoped tag
// would also load on the member portal and every admin screen, sending
// Google a stream of staff page views that have nothing to do with ads.
//
// Gated on the real hostname rather than the path, so staging and localhost
// never report conversions into the live Ads account.

export const GOOGLE_ADS_ID = 'AW-965377656'

/** The conversion action Chris set up for a day pass purchase. */
export const DAY_PASS_CONVERSION = 'AW-965377656/UTahCL6szZQdEPj8qcwD'

const BOOKING_HOSTNAME = 'bookings.bizhaus.com'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default function GoogleAdsTag() {
  // Rendered from the server at first, where there is no hostname to check,
  // so the decision is made once the page is running in the browser.
  const [live, setLive] = useState(false)
  useEffect(() => { setLive(window.location.hostname === BOOKING_HOSTNAME) }, [])

  if (!live) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
    </>
  )
}

/**
 * Reports one completed purchase.
 *
 * Does nothing when the tag was never loaded, which is every environment
 * except the live booking site, so a test booking on staging cannot report a
 * conversion. Safe to call more than once for the same booking: Google
 * deduplicates on transaction_id.
 */
export function reportConversion(opts: { value: number; transactionId: string }) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', 'conversion', {
    send_to: DAY_PASS_CONVERSION,
    value: opts.value,
    currency: 'USD',
    transaction_id: opts.transactionId,
  })
}
