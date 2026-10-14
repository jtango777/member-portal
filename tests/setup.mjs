// Lets tests import the real application modules instead of copies.
//
// Three gaps between what Next resolves and what bare Node resolves:
//   - the "@/..." alias, which is a bundler convention Node knows nothing of
//   - missing file extensions, which bundlers fill in and Node does not
//   - next/headers, reached through settings and the Supabase client, which
//     only exists inside a Next runtime and is not under test here
// All three are mapped here so the tests exercise the real code that builds
// customer emails (2026-10-05).
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { existsSync } from 'node:fs'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']

const STUBS = {
  'next/headers': resolvePath(ROOT, 'tests/stubs/next-headers.mjs'),
}

/** First path that exists once an extension is tried, or null. */
function withExtension(basePath) {
  for (const ext of EXTENSIONS) {
    if (existsSync(basePath + ext)) return basePath + ext
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) {
      return nextResolve(pathToFileURL(STUBS[specifier]).href, context)
    }

    if (specifier.startsWith('@/')) {
      const found = withExtension(resolvePath(ROOT, specifier.slice(2)))
      if (found) return nextResolve(pathToFileURL(found).href, context)
    }

    try {
      return nextResolve(specifier, context)
    } catch (err) {
      // A relative import with no extension, which bundlers allow.
      if (specifier.startsWith('.') && context.parentURL) {
        const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
        const found = withExtension(base)
        if (found) return nextResolve(pathToFileURL(found).href, context)
      }
      throw err
    }
  },
})
