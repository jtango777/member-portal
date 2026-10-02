import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescriptRules from 'eslint-config-next/typescript'

// Lint was broken in two layers and nobody noticed, because `npm run lint`
// failed with "no such directory: .../lint" — which reads like a config
// quirk rather than "the linter is not running" (2026-10-01).
//
// Layer one: Next 16 removed `next lint`, so the script ran `next lint` as
// `next <directory>`. Layer two, underneath it: this file used the
// FlatCompat shim to load the old-style config, and eslint-config-next 16
// ships real flat configs, so the shim crashed on a circular structure.
//
// It mattered. On 2026-10-01 a `phone` argument was used but never
// destructured, which broke account creation for every new day pass
// customer in production. `no-undef` catches that in under a second.

const eslintConfig = [
  ...coreWebVitals,
  ...typescriptRules,
  {
    // .claude/worktrees holds a stale scratch copy of the repo from an agent
    // run. Linting it double-reported every finding against code that is not
    // shipped (2026-10-01).
    ignores: ['.next/**', 'node_modules/**', 'supabase/**', 'scripts-tmp-*.mjs', '.claude/**'],
  },
]

export default eslintConfig
