// Shared password rule for every place a member/admin sets or resets their
// portal password — setup-account, reset-password, register, admin-setup,
// and both invite-accept routes. Centralized 2026-09-10 so all six stayed
// in sync instead of drifting (they'd all independently only checked
// length before this).
export const PASSWORD_REQUIREMENTS_TEXT =
  'Must be at least 8 characters, with an uppercase letter, a number, and a symbol.'

const SYMBOL_RE = /[!@#$%^&*(),.?":{}|<>_\-+=[\]/\\;'~`]/

// States every unmet requirement at once, not just the first one hit —
// Caroline caught that fixing one only to immediately hit the next one on
// resubmit was annoying. This is also why PASSWORD_REQUIREMENTS_TEXT
// exists separately: shown up front as a hint, so ideally nobody even
// sees this error the first time.
export function passwordError(password: string): string | null {
  const missing: string[] = []
  if (password.length < 8) missing.push('at least 8 characters')
  if (!/[A-Z]/.test(password)) missing.push('an uppercase letter')
  if (!/[0-9]/.test(password)) missing.push('a number')
  if (!SYMBOL_RE.test(password)) missing.push('a symbol (like ! or #)')
  if (missing.length === 0) return null
  return `Password needs ${missing.join(', ')}.`
}
