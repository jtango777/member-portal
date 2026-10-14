'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

// Without this, a render error anywhere in Reports throws away the whole page
// and the browser shows its own "this page couldn't load", which says nothing
// and leaves no way to find out what broke. The Day Pass Demand and Channels
// report did exactly that on its first real load and could not be diagnosed
// from the outside (Caroline, 2026-10-14).
//
// So: show the error, on screen, in words that can be screenshotted.

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[reports] Render failed:', error)
  }, [error])

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">This report could not be shown</h2>
            <p className="text-sm text-gray-600 mt-1">
              The rest of the admin area is unaffected. Nothing was changed or lost.
            </p>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-1.5">
              What went wrong
            </p>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 whitespace-pre-wrap break-words max-h-80 overflow-auto">
              {error.message || 'No message was given.'}
              {error.digest ? `\n\nReference: ${error.digest}` : ''}
              {/* The message alone was not enough to find a crash that could
                  not be reproduced locally; the stack names the component
                  (Caroline, 2026-10-14). */}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
            <p className="text-xs text-gray-400 mt-2">
              Screenshot this. It is what someone needs to fix it.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                onClick={reset}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Try again
              </button>
              <a
                href="/dashboard/admin/reports"
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
              >
                Back to reports
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
