'use client'

import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = ['Bug', 'Idea', 'Question', 'Other']

export default function FeedbackForm() {
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
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to submit feedback')
    }
    setSubmitting(false)
  }

  return (
    <div className="mt-10 pt-8 border-t border-gray-200 max-w-lg">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquarePlus size={18} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Have feedback on the portal?</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full sm:w-40 border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </div>
  )
}
