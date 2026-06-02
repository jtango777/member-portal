'use client'

import { useState } from 'react'
import { PermittedEmail, Company } from '@/types'
import { Plus, Send, Check, X, Shield } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type Props = { members: PermittedEmail[]; companies: Company[] }

export default function MembersManager({ members: initial, companies }: Props) {
  const [members, setMembers]     = useState(initial)
  const [showForm, setShowForm]   = useState(false)
  const [email, setEmail]         = useState('')
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [sending, setSending]     = useState(false)
  const [resending, setResending] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    const res = await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, company_id: companyId }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Invite sent!')
      setEmail('')
      setShowForm(false)
      // Refresh list
      const r = await fetch('/api/admin/members')
      setMembers(await r.json())
    } else {
      toast.error(data.error ?? 'Failed to send invite')
    }
    setSending(false)
  }

  async function handleResend(memberId: string, memberEmail: string) {
    setResending(memberId)
    const res = await fetch('/api/invites/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    if (res.ok) toast.success(`Invite resent to ${memberEmail}`)
    else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to resend')
    }
    setResending(null)
  }

  async function toggleAdmin(userId: string, currentValue: boolean) {
    const res = await fetch('/api/admin/members/toggle-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_admin: !currentValue }),
    })
    if (res.ok) {
      toast.success('Admin status updated')
      const r = await fetch('/api/admin/members')
      setMembers(await r.json())
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage who has access to BizHaus.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Member
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleInvite} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Invite New Member</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="member@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={sending}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              <Send size={14} /> {sending ? 'Sending…' : 'Send Invite'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Email</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Status</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Invited</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No members yet.</td></tr>
            )}
            {members.map(m => (
              <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{m.email}</td>
                <td className="px-4 py-3 text-gray-600">{m.companies?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {m.accepted_at ? (
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">
                      <Check size={11} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-xs font-medium px-2 py-0.5 rounded-full">
                      Invited
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {formatShortDate(new Date(m.invited_at))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {!m.accepted_at && (
                      <button
                        onClick={() => handleResend(m.id, m.email)}
                        disabled={resending === m.id}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {resending === m.id ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
