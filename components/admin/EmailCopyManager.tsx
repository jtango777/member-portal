'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { EMAIL_TEMPLATES } from '@/lib/emailCopy'
import TabPanel from '@/components/TabPanel'

// Editing the wording of customer emails. Only the words: the layout, the
// logo, the booking details table and the door code live in code, because a
// stray character in hand-built email HTML breaks every send and you find out
// from customers (Caroline, 2026-10-01).

export default function EmailCopyManager() {
  const [copy, setCopy] = useState<Record<string, string> | null>(null)
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(EMAIL_TEMPLATES[0].id)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ id: string; lines?: { label: string; text: string }[]; html?: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/email-copy')
      .then(r => r.json())
      .then(d => { setCopy(d.copy ?? {}); setDefaults(d.defaults ?? {}) })
      .catch(() => toast.error('Could not load the email wording'))
  }, [])

  const dirty = copy ? Object.keys(defaults).some(k => (copy[k] ?? '') !== (defaults[k] ?? '')) : false

  async function save() {
    if (!copy) return
    setSaving(true)
    const res = await fetch('/api/admin/email-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy }),
    })
    const d = await res.json()
    if (res.ok) toast.success('Saved. New emails will use this wording.')
    else toast.error(d.error ?? 'Could not save')
    setSaving(false)
  }

  async function showPreview(templateId: string) {
    const res = await fetch('/api/admin/email-copy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, copy }),
    })
    const d = await res.json()
    setPreview({ id: templateId, lines: d.lines, html: d.html })
  }

  if (!copy) {
    return <div className="text-sm text-gray-400 py-10 text-center">Loading…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Change the wording customers read. The layout, logo and booking details are fixed,
          so nothing here can break an email. Leave a box empty to go back to the original wording.
        </p>
      </div>

      {EMAIL_TEMPLATES.map(t => {
        const isOpen = open === t.id
        return (
          <div key={t.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : t.id)}
              className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={15} className={cn('text-gray-400 transition-transform', isOpen && 'rotate-90')} />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-900">{t.name}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{t.description}</span>
              </span>
            </button>

            {isOpen && (
              <TabPanel>
                <div className="px-5 pb-5 pt-1 flex flex-col gap-4 border-t border-gray-100">
                  {t.fields.map(f => {
                    const value = copy[f.key] ?? ''
                    const changed = value.trim() !== (defaults[f.key] ?? '').trim()
                    return (
                      <div key={f.key}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-700">{f.label}</label>
                          {changed && (
                            <button
                              onClick={() => setCopy(c => ({ ...c!, [f.key]: defaults[f.key] }))}
                              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                            >
                              <RotateCcw size={11} /> Reset
                            </button>
                          )}
                        </div>
                        {f.multiline ? (
                          <textarea
                            rows={3}
                            value={value}
                            onChange={e => setCopy(c => ({ ...c!, [f.key]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={e => setCopy(c => ({ ...c!, [f.key]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                        {f.hint && <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>}
                      </div>
                    )
                  })}

                  <div>
                    <button
                      onClick={() => showPreview(t.id)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Preview this email
                    </button>
                  </div>

                  {preview?.id === t.id && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {preview.html ? (
                        <iframe
                          title="Email preview"
                          srcDoc={preview.html}
                          className="w-full h-[520px] bg-white rounded border border-gray-200"
                        />
                      ) : (
                        <div className="flex flex-col gap-3">
                          {preview.lines?.map(l => (
                            <div key={l.label}>
                              <div className="text-[11px] uppercase tracking-wide text-gray-400">{l.label}</div>
                              <div
                                className="text-sm text-gray-800 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: l.text }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabPanel>
            )}
          </div>
        )
      })}

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-gray-400">Unsaved changes</span>}
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save wording'}
        </button>
      </div>
    </div>
  )
}
