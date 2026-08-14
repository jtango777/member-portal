'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Check } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type FeedbackItem = {
  id: string
  category: string
  message: string
  created_at: string
  full_name: string
}

const CATEGORY_STYLES: Record<string, string> = {
  Bug: 'bg-red-50 text-red-700 border-red-200',
  Idea: 'bg-blue-50 text-blue-700 border-blue-200',
  Question: 'bg-amber-50 text-amber-700 border-amber-200',
  Other: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function FeedbackManager() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')
  // Ids currently mid-collapse — kept in `items` but rendered at zero height
  // so the accordion-close animation can play before they're actually removed.
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/feedback')
    if (r.ok) setItems(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleResolve(id: string) {
    setResolvingIds(prev => new Set(prev).add(id))
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    })
    if (!res.ok) {
      toast.error('Failed to resolve')
      setResolvingIds(prev => { const next = new Set(prev); next.delete(id); return next })
      return
    }
    // Let the collapse transition play, then actually drop it from the list.
    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id))
      setResolvingIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 250)
  }

  const categories = ['All', 'Bug', 'Idea', 'Question', 'Other']
  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-0.5">{items.length} submission{items.length !== 1 ? 's' : ''} from members</p>
      </div>

      <select value={filter} onChange={e => setFilter(e.target.value)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        {categories.map(c => (
          <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>
        ))}
      </select>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          <MessageSquare size={24} className="mx-auto mb-2 text-gray-300" />
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className={cn(
              'grid transition-[grid-template-rows,opacity] duration-250 ease-in-out',
              resolvingIds.has(item.id) ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
            )}>
              <div className="overflow-hidden">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Other)}>
                        {item.category}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{item.full_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{formatShortDate(new Date(item.created_at))}</span>
                      <div className="relative group">
                        <button onClick={() => handleResolve(item.id)}
                          className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors">
                          <Check size={14} />
                        </button>
                        {/* Below, not above, the button — the card's overflow-hidden
                            (used for the resolve fade-out) clips anything positioned
                            outside its box, which was cutting this off when it tried
                            to render above. */}
                        <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Resolve?
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
