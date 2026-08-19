// Staging is a separate Vercel deployment with its own NEXT_PUBLIC_APP_URL,
// so this can be decided at build/server time — no client-side hostname
// sniffing needed, and no fighting with React's own <title> reconciliation
// (which silently undoes a client-side document.title = ... on every
// re-render). Same "staging"/"member-portal" match as DevBanner.tsx.
//
// Shared by every layout's <title> so the "[Staging]" prefix stays
// consistent across the whole site (main app, /book, /day-pass, ...)
// instead of each one carrying its own copy of this check.
export const isStaging =
  (process.env.NEXT_PUBLIC_APP_URL ?? '').includes('staging') ||
  (process.env.NEXT_PUBLIC_APP_URL ?? '').includes('member-portal')
