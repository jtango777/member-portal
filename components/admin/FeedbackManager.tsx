'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

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

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/feedback')
    if (r.ok) setItems(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const categories = ['All', 'Bug', 'Idea', 'Question', 'Other']
  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-0.5">{items.length} submission{items.length !== 1 ? 's' : ''} from members</p>
      </div>

      <div className="flex gap-1.5">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              filter === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}>
            {c}
          </button>
        ))}
      </div>

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
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Other)}>
                    {item.category}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{item.full_name}</span>
                </div>
                <span className="text-xs text-gray-400">{formatShortDate(new Date(item.created_at))}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
