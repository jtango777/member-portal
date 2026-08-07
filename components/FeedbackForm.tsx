'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { MessageSquarePlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const CATEGORIES = ['Bug', 'Idea', 'Question', 'Other']

export default function FeedbackForm({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('Idea')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, message }),
    })
    if (res.ok) {
      toast.success('Thanks for the feedback!')
      setMessage('')
      setCategory('Idea')
      setOpen(false)
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to submit feedback')
    }
    setSubmitting(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          title={collapsed ? 'Have a question? Submit feedback' : undefined}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-left',
            collapsed && 'justify-center px-2'
          )}>
          <MessageSquarePlus size={16} className="flex-shrink-0" />
          {!collapsed && <span>Have a question? Submit feedback</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-[92vw] sm:w-full max-w-sm z-50 transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <Dialog.Title className="font-semibold text-gray-900 text-sm">Send feedback</Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {submitting ? 'Sending…' : 'Send feedback'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
