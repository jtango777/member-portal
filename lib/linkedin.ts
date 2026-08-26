// Members can only ever set the username segment of their LinkedIn profile,
// never a full URL — this is the one shared place that enforces that, used
// both in the settings form (so pasting a full profile URL still works,
// just gets trimmed down) and in the API route (so a direct API call can't
// bypass the UI and store something else).

const USERNAME_PATTERN = /^[a-zA-Z0-9-]{3,100}$/

// Accepts either a bare username or a pasted LinkedIn URL in any of its
// common forms, and returns just the username — or null if there's nothing
// usable in it. Never returns anything containing a scheme, domain, or
// extra path segments.
export function extractLinkedinUsername(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Pull the last non-empty path segment off a pasted URL, e.g.
  // "https://www.linkedin.com/in/janesmith/" -> "janesmith". A bare
  // username with no slashes just passes through this untouched. Checked
  // BEFORE stripping the query string matters — a query string can itself
  // contain the text "linkedin.com" (e.g. a redirect param) without the
  // URL actually being one.
  const withoutQuery = trimmed.split('?')[0]

  // Anything that looks like a URL (has a scheme, or a domain-like
  // "word.tld/" shape) must actually be a linkedin.com URL in its host —
  // otherwise this would happily turn "evil.com/phishing" into a
  // "phishing" username, which isn't unsafe (the hardcoded
  // linkedin.com/in/ prefix means it could never link anywhere else) but
  // is just wrong.
  const looksLikeUrl = /:\/\//.test(withoutQuery) || /^[\w-]+\.[a-z]{2,}\//i.test(withoutQuery)
  if (looksLikeUrl && !/linkedin\.com/i.test(withoutQuery)) return null

  const segments = withoutQuery.split('/').filter(Boolean)
  const candidate = segments[segments.length - 1] ?? ''

  return USERNAME_PATTERN.test(candidate) ? candidate : null
}

export function linkedinUrl(username: string): string {
  return `https://www.linkedin.com/in/${username}`
}
