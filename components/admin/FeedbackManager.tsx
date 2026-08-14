'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Check, RotateCcw, ChevronRight, User } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type FeedbackItem = {
  id: string
  category: string
  message: string
  created_at: string
  full_name: string
  notes: string | null
  assigned_to: string | null
  assignee_name: string | null
}

type Admin = { id: string; full_name: string }

type Tab = 'open' | 'resolved'

const CATEGORY_STYLES: Record<string, string> = {
  Bug: 'bg-red-50 text-red-700 border-red-200',
  Idea: 'bg-blue-50 text-blue-700 border-blue-200',
  Question: 'bg-amber-50 text-amber-700 border-amber-200',
  Other: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function FeedbackManager() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('open')
  const [filter, setFilter] = useState<string>('All')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [savingNotes, setSavingNotes] = useState<Set<string>>(new Set())
  // Ids currently mid-collapse — kept in `items` but rendered at zero height
  // so the accordion-close animation can play before they're actually removed.
  const [transitioningIds, setTransitioningIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async (t: Tab) => {
    setLoading(true)
    const r = await fetch(`/api/admin/feedback?resolved=${t === 'resolved'}`)
    if (r.ok) {
      const data = await r.json()
      setItems(data.items)
      setAdmins(data.admins)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh(tab) }, [refresh, tab])

  function toggleExpand(item: FeedbackItem) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
        setNotesDraft(d => ({ ...d, [item.id]: d[item.id] ?? item.notes ?? '' }))
      }
      return next
    })
  }

  async function handleSaveNotes(id: string) {
    setSavingNotes(prev => new Set(prev).add(id))
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft[id] ?? '' }),
    })
    if (res.ok) {
      toast.success('Note saved')
      setItems(prev => prev.map(i => i.id === id ? { ...i, notes: notesDraft[id] ?? null } : i))
    } else {
      toast.error('Failed to save note')
    }
    setSavingNotes(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  async function handleAssign(id: string, assigneeId: string) {
    const admin = admins.find(a => a.id === assigneeId)
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assigneeId || null }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, assigned_to: assigneeId || null, assignee_name: admin?.full_name ?? null } : i))
      toast.success(assigneeId ? `Assigned to ${admin?.full_name}` : 'Unassigned')
    } else {
      toast.error('Failed to update assignment')
    }
  }

  // Shared by Resolve and Reopen — both move an item out of the currently
  // visible tab, so both need the same "let the collapse play, then drop
  // it from the list" handling.
  async function handleSetResolved(id: string, resolved: boolean) {
    setTransitioningIds(prev => new Set(prev).add(id))
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    })
    if (!res.ok) {
      toast.error(resolved ? 'Failed to resolve' : 'Failed to reopen')
      setTransitioningIds(prev => { const next = new Set(prev); next.delete(id); return next })
      return
    }
    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id))
      setTransitioningIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 250)
  }

  const categories = ['All', 'Bug', 'Idea', 'Question', 'Other']
  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} {tab === 'open' ? 'open' : 'resolved'} submission{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 text-sm">
          {(['open', 'resolved'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-md font-medium transition-colors',
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              {t === 'open' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
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
          {tab === 'open' ? 'No open feedback.' : 'No resolved feedback yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expandedIds.has(item.id)
            return (
              <div key={item.id} className={cn(
                'grid transition-[grid-template-rows,opacity] duration-250 ease-in-out',
                transitioningIds.has(item.id) ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
              )}>
                <div className="overflow-hidden">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => toggleExpand(item)} className="flex items-center gap-2 min-w-0 text-left">
                        <ChevronRight size={14} className={cn('text-gray-400 flex-shrink-0 transition-transform duration-200', isExpanded && 'rotate-90')} />
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded border flex-shrink-0', CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Other)}>
                          {item.category}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">{item.full_name}</span>
                        {item.assignee_name && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                            <User size={11} /> {item.assignee_name}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400">{formatShortDate(new Date(item.created_at))}</span>
                        {tab === 'open' ? (
                          <div className="relative group">
                            <button onClick={() => handleSetResolved(item.id, true)}
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
                        ) : (
                          <div className="relative group">
                            <button onClick={() => handleSetResolved(item.id, false)}
                              className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                              <RotateCcw size={13} />
                            </button>
                            <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                              Reopen?
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>

                    <div className={cn('grid transition-[grid-template-rows] duration-200 ease-in-out', isExpanded ? 'grid-rows-[1fr] mt-3' : 'grid-rows-[0fr]')}>
                      <div className="overflow-hidden">
                        <div className="border-t border-gray-100 pt-3 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Assign to</label>
                            <select
                              value={item.assigned_to ?? ''}
                              onChange={e => handleAssign(item.id, e.target.value)}
                              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Unassigned</option>
                              {admins.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Internal note</label>
                            <textarea
                              value={notesDraft[item.id] ?? ''}
                              onChange={e => setNotesDraft(d => ({ ...d, [item.id]: e.target.value }))}
                              rows={2}
                              placeholder="Not visible to the member…"
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                            <button
                              onClick={() => handleSaveNotes(item.id)}
                              disabled={savingNotes.has(item.id) || (notesDraft[item.id] ?? '') === (item.notes ?? '')}
                              className="mt-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-2.5 py-1 rounded-md"
                            >
                              {savingNotes.has(item.id) ? 'Saving…' : 'Save note'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
