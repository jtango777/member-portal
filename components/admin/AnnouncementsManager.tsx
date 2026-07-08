'use client'

import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type Announcement = { id: string; message: string; created_at: string }

export default function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/announcements')
    if (r.ok) setAnnouncements(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    setPosting(true)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (res.ok) {
      toast.success('Announcement posted — members will see it next time they visit.')
      setMessage('')
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to post')
    }
    setPosting(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Posting a new announcement shows it as a one-time popup to every member.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <form onSubmit={handlePost} className="space-y-3">
          <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={3}
            placeholder="e.g. The Costa Mesa lobby will be closed for renovations July 20-22."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={posting || !message.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <Send size={14} /> {posting ? 'Posting…' : 'Post Announcement'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-blue-600">History</h2>
        </div>
        <div>
          {loading ? (
            <p className="text-sm text-gray-400 p-4">Loading…</p>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No announcements posted yet.</p>
          ) : (
            announcements.map(a => (
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
  )
}
