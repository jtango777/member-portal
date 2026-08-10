// Server-side verification for Google reCAPTCHA v2 ("I'm not a robot" checkbox).
// Call this from any API route that accepts a public-facing form submission.
export async function verifyRecaptcha(token: string | undefined | null): Promise<boolean> {
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
