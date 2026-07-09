'use client'

import { useState, useEffect, useCallback } from 'react'
import { Company } from '@/types'
import { Plus, Send, Check, Shield, ShieldOff, Download, Copy, Link, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import AssignPhotoDialog from '@/components/admin/AssignPhotoDialog'

function IconAction({ icon: Icon, label, onClick, disabled, colorClass }: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  colorClass: string
}) {
  return (
    <div className="relative group">
      <button onClick={onClick} disabled={disabled}
        className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${colorClass}`}>
        <Icon size={14} />
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  )
}

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
  const [editingCompany, setEditingCompany] = useState<{ id: string; companyId: string } | null>(null)
  const [savingCompany, setSavingCompany]   = useState(false)
  const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null)
  const [savingName, setSavingName]   = useState(false)
  const [confirmRemove, setConfirmRemove]   = useState<string | null>(null)
  const [removing, setRemoving]             = useState<string | null>(null)
  const [confirmInviteAll, setConfirmInviteAll] = useState(false)
  const [invitingAll, setInvitingAll]           = useState(false)
  const [photoTarget, setPhotoTarget] = useState<{ type: 'member' | 'pending'; id: string; name: string } | null>(null)
  const [activePage, setActivePage]   = useState(1)
  const [pendingPage, setPendingPage] = useState(1)
  const [showAllActive, setShowAllActive]   = useState(false)
  const [showAllPending, setShowAllPending] = useState(false)
  const PAGE_SIZE = 10

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/members/details')
    setMembers(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { setActivePage(1); setPendingPage(1) }, [search])

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

  // ── Edit company ──────────────────────────────────────────────────────────

  async function saveCompany(memberId: string) {
    if (!editingCompany) return
    setSavingCompany(true)
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: editingCompany.companyId }),
    })
    if (res.ok) {
      toast.success('Company updated')
      setEditingCompany(null)
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSavingCompany(false)
  }

  // ── Edit expected name (pending only) ───────────────────────────────────────

  async function saveName(memberId: string) {
    if (!editingName) return
    setSavingName(true)
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editingName.name.trim() || null }),
    })
    if (res.ok) {
      toast.success('Name updated')
      setEditingName(null)
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSavingName(false)
  }

  // ── Remove member ──────────────────────────────────────────────────────────

  async function handleRemove(memberId: string) {
    setRemoving(memberId)
    const res = await fetch(`/api/admin/members/${memberId}`, { method: 'DELETE' })
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

  // ── Invite all uninvited ───────────────────────────────────────────────────

  async function handleInviteAll() {
    setInvitingAll(true)
    setConfirmInviteAll(false)
    const res  = await fetch('/api/invites/send-all', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Something went wrong')
    } else if (data.sent === 0) {
      toast.success('Everyone has already been invited!')
    } else if (data.failed > 0) {
      toast.success(`${data.sent} invites sent, ${data.failed} failed`)
    } else {
      toast.success(`${data.sent} invites sent!`)
    }
    await refresh()
    setInvitingAll(false)
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

  const active      = filtered.filter(m => !!m.accepted_at)
  const pending     = filtered.filter(m => !m.accepted_at)
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))
  const notInvited  = members.filter(m => !m.accepted_at && !m.invite_token)

  const activeTotalPages  = Math.max(1, Math.ceil(active.length / PAGE_SIZE))
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE))
  const pagedActive  = showAllActive  ? active  : active.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const pagedPending = showAllPending ? pending : pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE)

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
          {notInvited.length > 0 && !confirmInviteAll && (
            <button onClick={() => setConfirmInviteAll(true)} disabled={invitingAll}
              className="flex items-center gap-1.5 text-sm border border-blue-300 hover:bg-blue-50 text-blue-700 font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
              <Send size={14} /> {invitingAll ? 'Sending…' : `Invite Uninvited (${notInvited.length})`}
            </button>
          )}
          {confirmInviteAll && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-blue-800 font-medium">Send {notInvited.length} invites?</span>
              <button onClick={handleInviteAll}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1 rounded">
                Yes, send
              </button>
              <button onClick={() => setConfirmInviteAll(false)}
                className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}
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
        <Section title={`Active Members (${active.length})`} footer={
          <Pagination page={activePage} totalPages={activeTotalPages} onPageChange={setActivePage}
            showAll={showAllActive} onToggleShowAll={() => setShowAllActive(v => !v)} />
        }>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[18%]" /><col className="w-[24%]" /><col className="w-[18%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th>Admin</Th><Th>Joined</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pagedActive.map(m => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 truncate" title={m.full_name ?? undefined}>{m.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 truncate" title={m.email}>{m.email}</td>
                  <td className="px-4 py-3 truncate">
                    {editingCompany?.id === m.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={editingCompany.companyId}
                          onChange={e => setEditingCompany({ id: m.id, companyId: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => saveCompany(m.id)} disabled={savingCompany}
                          className="text-xs text-blue-600 font-medium hover:text-blue-800">{savingCompany ? '…' : 'Save'}</button>
                        <button onClick={() => setEditingCompany(null)}
                          className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                      </div>
                    ) : (
                      <span className="text-gray-600" title={m.company_name}>{m.company_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.is_admin
                      ? <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Shield size={10} /> Admin</span>
                      : <span className="text-xs text-gray-400">Member</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(new Date(m.accepted_at!))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {editingCompany?.id !== m.id && (
                        <IconAction
                          icon={Edit2}
                          label="Change company"
                          onClick={() => setEditingCompany({ id: m.id, companyId: m.company_id })}
                          colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        />
                      )}
                      {m.user_id && (
                        <IconAction
                          icon={Camera}
                          label="Add picture"
                          onClick={() => setPhotoTarget({ type: 'member', id: m.user_id!, name: m.full_name ?? m.email })}
                          colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        />
                      )}
                      {m.user_id && (
                        <IconAction
                          icon={m.is_admin ? ShieldOff : Shield}
                          label={m.is_admin ? 'Remove admin access' : 'Grant admin access'}
                          onClick={() => toggleAdmin(m.user_id!, m.is_admin)}
                          disabled={togglingAdmin === m.user_id}
                          colorClass={m.is_admin ? 'text-red-500 hover:bg-red-50' : 'text-blue-500 hover:bg-blue-50'}
                        />
                      )}
                      {confirmRemove === m.id ? (
                        <div className="flex items-center gap-1.5 ml-1">
                          <span className="text-xs text-red-600">Remove?</span>
                          <button onClick={() => handleRemove(m.id)} disabled={removing === m.id}
                            className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                            {removing === m.id ? '…' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-400">No</button>
                        </div>
                      ) : (
                        <IconAction
                          icon={Trash2}
                          label="Remove member"
                          onClick={() => setConfirmRemove(m.id)}
                          colorClass="text-gray-400 hover:bg-red-50 hover:text-red-500"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <Section title={`Pending (${pending.length})`} footer={
          <Pagination page={pendingPage} totalPages={pendingTotalPages} onPageChange={setPendingPage}
            showAll={showAllPending} onToggleShowAll={() => setShowAllPending(v => !v)} />
        }>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[20%]" /><col className="w-[24%]" /><col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[10%]" /><col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th>Status</Th><Th>Added</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pagedPending.map(m => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingName?.id === m.id ? (
                      <div className="flex items-center gap-1">
                        <input value={editingName.name} onChange={e => setEditingName({ id: m.id, name: e.target.value })}
                          autoFocus placeholder="Full name"
                          className="border border-gray-300 rounded px-1.5 py-1 text-xs w-16 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={() => saveName(m.id)} disabled={savingName}
                          className="text-xs text-blue-600 font-medium hover:text-blue-800">{savingName ? '…' : 'Save'}</button>
                        <button onClick={() => setEditingName(null)}
                          className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingName({ id: m.id, name: m.full_name ?? '' })}
                        className="flex items-center gap-1.5 group text-left w-full min-w-0">
                        {m.full_name
                          ? <span className="text-gray-900 font-medium truncate" title={m.full_name}>{m.full_name}</span>
                          : <span className="text-gray-400 italic">Add name</span>}
                        <Edit2 size={10} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 truncate" title={m.email}>{m.email}</td>
                  <td className="px-4 py-3 truncate">
                    {editingCompany?.id === m.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={editingCompany.companyId}
                          onChange={e => setEditingCompany({ id: m.id, companyId: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => saveCompany(m.id)} disabled={savingCompany}
                          className="text-xs text-blue-600 font-medium hover:text-blue-800">{savingCompany ? '…' : 'Save'}</button>
                        <button onClick={() => setEditingCompany(null)}
                          className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                      </div>
                    ) : (
                      <span className="text-gray-600" title={m.company_name}>{m.company_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge m={m} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(new Date(m.invited_at))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {editingCompany?.id !== m.id && (
                        <IconAction
                          icon={Edit2}
                          label="Change company"
                          onClick={() => setEditingCompany({ id: m.id, companyId: m.company_id })}
                          colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        />
                      )}
                      <IconAction
                        icon={Camera}
                        label="Add picture"
                        onClick={() => setPhotoTarget({ type: 'pending', id: m.id, name: m.email })}
                        colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      />
                      {m.invite_token?.startsWith('http') && (
                        <IconAction
                          icon={copiedLink === m.id ? Check : Copy}
                          label={copiedLink === m.id ? 'Copied!' : 'Copy invite link'}
                          onClick={() => copyLink(m.invite_token!, m.id)}
                          colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        />
                      )}
                      <IconAction
                        icon={Send}
                        label="Invite"
                        onClick={() => handleResend(m.id)}
                        disabled={resending === m.id}
                        colorClass="text-blue-500 hover:bg-blue-50"
                      />
                      {confirmRemove === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-600">Remove?</span>
                          <button onClick={() => handleRemove(m.id)} disabled={removing === m.id}
                            className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                            {removing === m.id ? '…' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-400">No</button>
                        </div>
                      ) : (
                        <IconAction
                          icon={Trash2}
                          label="Remove"
                          onClick={() => setConfirmRemove(m.id)}
                          colorClass="text-gray-400 hover:bg-red-50 hover:text-red-500"
                        />
                      )}
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

      {photoTarget && (
        <AssignPhotoDialog
          open={!!photoTarget}
          onOpenChange={v => { if (!v) setPhotoTarget(null) }}
          onSuccess={refresh}
          targetType={photoTarget.type}
          targetId={photoTarget.id}
          memberName={photoTarget.name}
        />
      )}
    </div>
  )
}

function StatusBadge({ m }: { m: MemberRow }) {
  if (m.accepted_at)  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Check size={10} /> Active</span>
  if (m.invite_token) return <span className="whitespace-nowrap text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Invited</span>
  return <span className="whitespace-nowrap text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Not invited</span>
}

function Pagination({ page, totalPages, onPageChange, showAll, onToggleShowAll }: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  showAll: boolean
  onToggleShowAll: () => void
}) {
  if (totalPages <= 1 && !showAll) return null
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs">
      <button onClick={onToggleShowAll} className="text-blue-600 hover:text-blue-800 font-medium">
        {showAll ? 'Show 10 per page' : 'Show all'}
      </button>
      {!showAll && totalPages > 1 && (
        <div className="flex items-center gap-1.5 text-gray-500">
          <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
            className="p-1 hover:text-gray-800 disabled:opacity-30 rounded">
            <ChevronLeft size={14} />
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="p-1 hover:text-gray-800 disabled:opacity-30 rounded">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function Section({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-blue-600">{title}</h2>
      </div>
      {children}
      {footer}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">{children}</th>
}
