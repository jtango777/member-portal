import { recaptchaDisabled } from '@/lib/recaptchaDisabled'

// Server-side verification for Google reCAPTCHA v2 ("I'm not a robot" checkbox).
// Call this from any API route that accepts a public-facing form submission.
export async function verifyRecaptcha(token: string | undefined | null): Promise<boolean> {
  // Staging and local dev can turn this off, so signup, day-pass and /book
  // can actually be tested end to end — there is no way to click a real
  // "I'm not a robot" box from a test script, which is why these paths kept
  // getting checked by hand, or not at all (Caroline, 2026-10-16). See
  // lib/recaptchaDisabled.ts for what has to be true before this fires.
  if (recaptchaDisabled) {
    console.warn('[recaptcha] Verification skipped — staging/dev. Never in production.')
    return true
  }

  if (!token) return false

  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) {
    console.error('[recaptcha] RECAPTCHA_SECRET_KEY is not set — failing closed.')
    return false
  }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json()
    if (!data.success) {
      // error-codes tells us WHY: "invalid-input-secret" = wrong/missing
      // secret key, "timeout-or-duplicate" = token reused or expired,
      // "invalid-input-response" = malformed/missing token.
      console.error('[recaptcha] Verification failed:', data['error-codes'])
    }
    return data.success === true
  } catch (err) {
    console.error('[recaptcha] Verification request failed:', err)
    return false
  }
}
