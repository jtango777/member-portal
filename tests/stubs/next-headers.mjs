// lib/email.ts reaches lib/settings.ts, which reaches the Supabase server
// client, which imports next/headers. None of that runs in these tests: the
// email builders take their copy as an argument rather than fetching it. The
// stub exists only so the import chain resolves outside a Next runtime.
export function cookies() {
  return { getAll: () => [], get: () => undefined, set: () => {} }
}
export function headers() {
  return new Map()
}
