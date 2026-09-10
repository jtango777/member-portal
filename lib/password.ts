// Shared password rule for every place a member/admin sets or resets their
// portal password — setup-account, reset-password, register, admin-setup,
// and both invite-accept routes. Centralized 2026-09-10 so all six stayed
// in sync instead of drifting (they'd all independently only checked
// length before this).
export const PASSWORD_REQUIREMENTS_TEXT =
  'Must be at least 8 characters, with an uppercase letter, a number, and a symbol.'

const SYMBOL_RE = /[!@#$%^&*(),.?":{}|<>_\-+=[\]/\\;'~`]/

export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  if (!SYMBOL_RE.test(password)) return 'Password must include a symbol (like ! or #).'
  return null
}
