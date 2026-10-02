'use client'

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CopyTemplate } from '@/lib/emailCopy'
import { cn } from '@/lib/utils'

// Editing one email: the words on the left, the real email on the right,
// updating as you type (Caroline, 2026-10-01). The preview renders through
// the same builders the send path uses, so it cannot drift from what goes
// out.

export default function EmailTemplateDialog({
  template, copy, defaults, onChange, onSaved, onOpenChange,
}: {
  template: CopyTemplate | null
  copy: Record<string, string>
  defaults: Record<string, string>
  onChange: (next: Record<string, string>) => void
  onSaved: () => void
  onOpenChange: (open: boolean) => void
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [subject, setSubject] = useState<string>('')
  const [variant, setVariant] = useState<string>('refunded')
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced: re-rendering on every keystroke would be a request per letter.
  useEffect(() => {
    if (!template) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetch('/api/admin/email-copy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, copy, variant }),
      })
        .then(r => r.json())
        .then(d => { setHtml(d.html ?? null); setSubject(d.subject ?? '') })
        .catch(() => setHtml(null))
    }, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [template, copy, variant])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/email-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy }),
    })
    if (res.ok) {
      toast.success('Saved. New emails will use this wording.')
      onSaved()
      onOpenChange(false)
    } else {
      toast.error((await res.json()).error ?? 'Could not save')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={!!template} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 bg-black/40 z-40" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="dialog-panel bg-white rounded-xl border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <Dialog.Title className="text-base font-semibold text-gray-900">{template?.name}</Dialog.Title>
                <p className="text-xs text-gray-500 mt-0.5 max-w-2xl leading-relaxed">{template?.description}</p>
              </div>
              <Dialog.Close className="text-gray-400 hover:text-gray-600 mt-1"><X size={18} /></Dialog.Close>
            </div>

            <div className="flex-1 grid md:grid-cols-2 min-h-0">
              {/* The words */}
              <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4 border-r border-gray-100">
                {template?.fields.map(f => {
                  const value = copy[f.key] ?? ''
                  const changed = value.trim() !== (defaults[f.key] ?? '').trim()
                  // A line that belongs to the other version of this email is
                  // not in the preview right now, so say so and dim it rather
                  // than letting someone type into a box that appears to do
                  // nothing (Caroline, 2026-10-01).
                  const hidden = !!f.onlyIn && f.onlyIn !== variant
                  const show = () => { if (f.onlyIn) setVariant(f.onlyIn) }
                  return (
                    <div key={f.key} className={cn('transition-opacity', hidden && 'opacity-50')}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700">
                          {f.label}
                          {hidden && (
                            <button
                              onClick={show}
                              className="ml-2 font-normal text-[11px] text-blue-600 hover:underline"
                            >
                              Not in the version shown. Show it
                            </button>
                          )}
                        </label>
                        {changed && (
                          <button
                            onClick={() => onChange({ ...copy, [f.key]: defaults[f.key] })}
                            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <RotateCcw size={11} /> Reset
                          </button>
                        )}
                      </div>
                      {f.multiline ? (
                        <textarea
                          rows={f.rows ?? 3}
                          value={value}
                          onFocus={show}
                          onChange={e => onChange({ ...copy, [f.key]: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          value={value}
                          onFocus={show}
                          onChange={e => onChange({ ...copy, [f.key]: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {f.hint && <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{f.hint}</p>}
                    </div>
                  )
                })}
              </div>

              {/* The email */}
              <div className="overflow-y-auto bg-gray-50 flex flex-col">
                {template?.variants && (
                  <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-1.5">Showing</span>
                    {template.variants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setVariant(v.id)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                          variant === v.id
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700',
                        )}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
                {subject && (
                  <div className="px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-2">Subject</span>
                    <span className="text-sm text-gray-800">{subject}</span>
                  </div>
                )}
                {html ? (
                  <iframe title="Email preview" srcDoc={html} className="w-full flex-1 min-h-[600px] bg-white border-0" />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">Rendering…</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2">
                Close
              </Dialog.Close>
              <button
                onClick={save}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
