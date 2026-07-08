'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Send, Link as LinkIcon, Copy, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type CompanyMember = {
  id: string
  email: string
  invited_at: string
  accepted_at: string | null
  user_id: string | null
  full_name: string | null
  is_active: boolean
  is_company_admin: boolean
}

export default function CompanyMembersManager({ companyName }: { companyName: string }) {
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/company/members')
    if (r.ok) setMembers(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setLastInviteLink(null)
    const res = await fetch('/api/company/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to invite')
    } else {
      setLastInviteLink(data.inviteLink)
      if (data.emailSent) toast.success('Invite sent!')
      else toast.success('Member added — copy the link below to invite them manually.')
      setEmail('')
      await refresh()
    }
    setSending(false)
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied!')
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId)
    const res = await fetch(`/api/company/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Member removed')
      setConfirmRemove(null)
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setRemoving(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{loading ? '…' : `${members.length} member${members.length === 1 ? '' : 's'}`}</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setLastInviteLink(null) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={15} /> Add Member
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Add New Member</h3>
          <form onSubmit={handleInvite} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="member@company.com" />
            </div>
            <button type="submit" disabled={sending}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              <Send size={13} /> {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
          {lastInviteLink && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <LinkIcon size={14} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-700 font-medium flex-1 truncate">{lastInviteLink}</span>
              <button onClick={() => copyLink(lastInviteLink)} className="text-blue-600 hover:text-blue-800">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map(m => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 text-gray-900">{m.full_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{m.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.accepted_at ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {m.accepted_at ? 'Active' : 'Invited'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {confirmRemove === m.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-gray-500">Remove?</span>
                      <button onClick={() => handleRemove(m.id)} disabled={removing === m.id}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-2.5 py-1 rounded">
                        {removing === m.id ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(m.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && members.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
