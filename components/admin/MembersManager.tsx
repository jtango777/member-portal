'use client'

import { useState, useEffect, useCallback } from 'react'
import { Company } from '@/types'
import { Plus, Send, Check, Shield, ShieldOff, Download, Copy, Link, Search } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type MemberRow = {
  id:           string
  email:        string
  company_id:   string
  company_name: string
  invited_at:   string
  accepted_at:  string | null
  invite_token: string | null
  user_id:      string | null
  full_name:    string | null
  is_admin:     boolean
}

type Props = { companies: Company[] }

export default function MembersManager({ companies }: Props) {
  const [members, setMembers]       = useState<MemberRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [email, setEmail]           = useState('')
  const [companyId, setCompanyId]   = useState(companies[0]?.id ?? '')
  const [sending, setSending]       = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin]   = useState<string | null>(null)
  const [resending, setResending]   = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/members/details')
    setMembers(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── Add member ─────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setLastInviteLink(null)
    const res  = await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, company_id: companyId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed')
    } else {
      setLastInviteLink(data.inviteLink)
      if (data.emailSent) toast.success('Invite sent!')
      else toast.success('Member added — copy the link below to invite them manually.')
      setEmail('')
      await refresh()
    }
    setSending(false)
  }

  // ── Resend / get link ──────────────────────────────────────────────────────

  async function handleResend(memberId: string) {
    setResending(memberId)
    const res  = await fetch('/api/invites/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.emailSent) toast.success('Invite resent!')
      else toast.success('Link generated — click the copy icon to get it.')
      // Store link against this member id so the row can show it
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, invite_token: data.inviteLink } : m
      ))
    } else {
      toast.error(data.error ?? 'Failed')
    }
    setResending(null)
  }

  // ── Copy link ──────────────────────────────────────────────────────────────

  async function copyLink(link: string, key: string) {
    await navigator.clipboard.writeText(link)
    setCopiedLink(key)
    setTimeout(() => setCopiedLink(null), 2000)
    toast.success('Link copied!')
  }

  // ── Toggle admin ───────────────────────────────────────────────────────────

  async function toggleAdmin(userId: string, currentIsAdmin: boolean) {
    setTogglingAdmin(userId)
    const res = await fetch('/api/admin/members/toggle-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_admin: !currentIsAdmin }),
    })
    if (res.ok) {
      toast.success(currentIsAdmin ? 'Admin access removed' : 'Admin access granted')
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setTogglingAdmin(null)
  }

  // ── CSV download ───────────────────────────────────────────────────────────

  function downloadCSV() {
    const rows = filtered.map(m => ({
      Name:         m.full_name ?? '',
      Email:        m.email,
      Company:      m.company_name,
      Status:       m.accepted_at ? 'Active' : m.invite_token ? 'Invited' : 'Not Invited',
      Admin:        m.is_admin ? 'Yes' : 'No',
      'Invited':    formatShortDate(new Date(m.invited_at)),
      'Accepted':   m.accepted_at ? formatShortDate(new Date(m.accepted_at)) : '',
    }))
    const headers = Object.keys(rows[0])
    const lines   = [headers.join(','), ...rows.map(r =>
      headers.map(h => {
        const v = String((r as any)[h] ?? '')
        return v.includes(',') ? `"${v}"` : v
      }).join(',')
    )]
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    a.download = 'bizhaus-members.csv'
    a.click()
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const q        = search.toLowerCase()
  const filtered = members.filter(m =>
    !q ||
    m.email.toLowerCase().includes(q) ||
    (m.full_name ?? '').toLowerCase().includes(q) ||
    m.company_name.toLowerCase().includes(q)
  )

  const active  = filtered.filter(m => !!m.accepted_at)
  const pending = filtered.filter(m => !m.accepted_at)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '…' : `${members.length} total · ${active.length} active · ${pending.length} pending`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadCSV}
            className="flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => { setShowForm(v => !v); setLastInviteLink(null) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Member
          </button>
        </div>
      </div>

      {/* Add member form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Add New Member</h3>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="member@company.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={sending}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                <Send size={13} /> {sending ? 'Saving…' : 'Add & Send Invite'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setLastInviteLink(null) }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
            </div>
          </form>

          {/* Invite link display */}
          {lastInviteLink && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <Link size={14} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-700 font-medium flex-1 truncate">{lastInviteLink}</span>
              <button onClick={() => copyLink(lastInviteLink, 'new')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold flex-shrink-0">
                {copiedLink === 'new' ? <Check size={12} /> : <Copy size={12} />}
                {copiedLink === 'new' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Search by name, email, or company…" />
      </div>

      {/* Active members */}
      {active.length > 0 && (
        <Section title={`Active Members (${active.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th>Admin</Th><Th>Joined</Th><Th />
              </tr>
            </thead>
            <tbody>
              {active.map(m => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-gray-600">{m.company_name}</td>
                  <td className="px-4 py-3">
                    {m.is_admin
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Shield size={10} /> Admin</span>
                      : <span className="text-xs text-gray-400">Member</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(new Date(m.accepted_at!))}</td>
                  <td className="px-4 py-3 text-right">
                    {m.user_id && (
                      <button
                        onClick={() => toggleAdmin(m.user_id!, m.is_admin)}
                        disabled={togglingAdmin === m.user_id}
                        title={m.is_admin ? 'Remove admin access' : 'Grant admin access'}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                          m.is_admin
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-blue-600 hover:bg-blue-50'
                        }`}>
                        {togglingAdmin === m.user_id
                          ? '…'
                          : m.is_admin
                          ? <><ShieldOff size={12} /> Remove Admin</>
                          : <><Shield size={12} /> Make Admin</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <Section title={`Pending (${pending.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Email</Th><Th>Company</Th><Th>Status</Th><Th>Added</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pending.map(m => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{m.email}</td>
                  <td className="px-4 py-3 text-gray-600">{m.company_name}</td>
                  <td className="px-4 py-3"><StatusBadge m={m} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(new Date(m.invited_at))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Show copy button if we have a stored link for this row */}
                      {m.invite_token?.startsWith('http') && (
                        <button onClick={() => copyLink(m.invite_token!, m.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                          {copiedLink === m.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedLink === m.id ? 'Copied' : 'Copy link'}
                        </button>
                      )}
                      <button
                        onClick={() => handleResend(m.id)}
                        disabled={resending === m.id}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
                        {resending === m.id ? '…' : 'Get link / Resend'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
          {search ? 'No members match your search.' : 'No members yet.'}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ m }: { m: MemberRow }) {
  if (m.accepted_at)  return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Check size={10} /> Active</span>
  if (m.invite_token) return <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Invited</span>
  return <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Not invited</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">{children}</th>
}
