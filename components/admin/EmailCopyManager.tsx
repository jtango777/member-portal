'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { EMAIL_TEMPLATES, type CopyProduct, type CopyTemplate } from '@/lib/emailCopy'
import EmailTemplateDialog from './EmailTemplateDialog'

// A list of the emails customers get. Clicking one opens it for editing with
// the real email alongside, updating as you type, rather than a stack of
// accordions you scroll past (Caroline, 2026-10-01).
//
// Only the words are editable, never the HTML: these emails are hand-built
// with inline styles because email clients are hostile, and one stray
// character would send every confirmation out broken.

export default function EmailCopyManager() {
  const [copy, setCopy] = useState<Record<string, string> | null>(null)
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [product, setProduct] = useState<CopyProduct>('day_pass')
  const [editing, setEditing] = useState<CopyTemplate | null>(null)

  useEffect(() => {
    fetch('/api/admin/email-copy')
      .then(r => r.json())
      .then(d => { setCopy(d.copy ?? {}); setSaved(d.copy ?? {}); setDefaults(d.defaults ?? {}) })
      .catch(() => toast.error('Could not load the email wording'))
  }, [])

  if (!copy) return <div className="text-sm text-gray-400 py-10 text-center">Loading…</div>

  const editedCount = (t: CopyTemplate) =>
    t.fields.filter(f => (copy[f.key] ?? '').trim() !== (defaults[f.key] ?? '').trim()).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-gray-200">
        {([['day_pass', 'Day Passes'], ['rooms', 'Conference Rooms']] as [CopyProduct, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setProduct(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              product === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {label} <span className="text-gray-400">{EMAIL_TEMPLATES.filter(t => t.product === key).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {EMAIL_TEMPLATES.filter(t => t.product === product).map(t => {
          const n = editedCount(t)
          return (
            <button
              key={t.id}
              onClick={() => setEditing(t)}
              className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                  {n > 0 && (
                    <span className="text-[10px] uppercase tracking-wide bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                      {n} edited
                    </span>
                  )}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{t.description}</span>
              </span>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          )
        })}
      </div>

      <EmailTemplateDialog
        template={editing}
        copy={copy}
        defaults={defaults}
        onChange={setCopy}
        onSaved={() => setSaved(copy)}
        // Closing without saving puts back whatever was last saved, so a
        // half-finished edit does not quietly hang around in the list.
        onOpenChange={open => { if (!open) { setCopy(saved); setEditing(null) } }}
      />
    </div>
  )
}
