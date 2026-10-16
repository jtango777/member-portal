import { isStaging } from '@/lib/isStaging'

// Whether the "I'm not a robot" check is turned off here.
//
// Shared by the server check (lib/recaptcha.ts) and the widget itself
// (components/Recaptcha.tsx) so the two can never disagree — a form that
// still demands a token on a server that no longer wants one is a dead end
// nobody can submit.
//
// Two locks, deliberately. The explicit switch alone would silence the check
// on any deployment that happened to inherit the variable; isStaging alone
// would silence it on anything whose URL happens to say "staging".
// Production satisfies neither. A local `next dev` needs no switch at all.
//
// Client-safe: both values are NEXT_PUBLIC_* or NODE_ENV, inlined at build.
export const recaptchaDisabled =
  process.env.NODE_ENV === 'development' ||
  (isStaging && process.env.NEXT_PUBLIC_DISABLE_RECAPTCHA === '1')

// What the widget hands the form in place of a real token. The server never
// looks at it: it has already decided not to check.
export const RECAPTCHA_DISABLED_TOKEN = 'recaptcha-disabled-on-staging'
