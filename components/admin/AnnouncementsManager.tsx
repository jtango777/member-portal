'use client'

import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Eye, X, ChevronDown } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import AnnouncementPreviewDialog from './AnnouncementPreviewDialog'

type Announcement = { id: string; message: string; created_at: string; active: boolean }

export default function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/announcements')
    if (r.ok) setAnnouncements(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setPreviewOpen(true)
  }

  async function handleConfirmPost() {
    setPosting(true)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (res.ok) {
      toast.success('Announcement posted — members will see it next time they visit.')
      setMessage('')
      setPreviewOpen(false)
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to post')
    }
    setPosting(false)
  }

  async function handleDeactivate(id: string) {
    setDeactivating(true)
    const res = await fetch(`/api/admin/announcements/${id}`, { method: 'PATCH' })
    if (res.ok) {
      toast.success('Announcement deactivated — members will no longer see it.')
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to deactivate')
    }
    setDeactivating(false)
  }

  const current = announcements.find(a => a.active)
  const history = announcements.filter(a => a.id !== current?.id)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Posting a new announcement shows it as a one-time popup to every member.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <form onSubmit={handlePreview} className="space-y-3">
          <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={3}
            placeholder="e.g. The Costa Mesa lobby will be closed for renovations July 20-22."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={!message.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <Eye size={14} /> Preview
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-blue-600">Current Announcement</h2>
        </div>
        <div>
          {loading ? (
            <p className="text-sm text-gray-400 p-4">Loading…</p>
          ) : !current ? (
            <p className="text-sm text-gray-400 p-4">No active announcement — members won't see a popup.</p>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3">
              <Megaphone size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-700">{current.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatShortDate(new Date(current.created_at))}</p>
              </div>
              <button onClick={() => handleDeactivate(current.id)} disabled={deactivating}
                className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50 flex-shrink-0">
                <X size={12} /> {deactivating ? '…' : 'Deactivate'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowPast(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 text-left">
          <h2 className="text-sm font-semibold text-blue-600">Past{history.length > 0 ? ` (${history.length})` : ''}</h2>
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`} />
        </button>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showPast ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            {loading ? (
              <p className="text-sm text-gray-400 p-4">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">No past announcements.</p>
            ) : (
              history.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                  <Megaphone size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatShortDate(new Date(a.created_at))}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnnouncementPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        message={message}
        onConfirm={handleConfirmPost}
        posting={posting}
      />
    </div>
  )
}
