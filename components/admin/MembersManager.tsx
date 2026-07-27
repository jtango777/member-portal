'use client'

import { useState, useEffect, useCallback } from 'react'
import NextLink from 'next/link'
import { Company } from '@/types'
import { Plus, Send, Check, Shield, ShieldOff, Download, Copy, Link, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Camera, Users, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
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
  id:                  string
  email:               string
  company_id:          string
  company_name:        string
  invited_at:          string
  accepted_at:         string | null
  invite_token:        string | null
  user_id:             string | null
  full_name:           string | null
  is_admin:            boolean
  avatar_url:          string | null
  default_location_id: string | null
  is_active:           boolean
}

type EditRow = {
  id:                  string
  full_name:           string
  email:               string
  company_id:          string
  default_location_id: string
  isActive:            boolean
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
  const [editingRow, setEditingRow] = useState<EditRow | null>(null)
  const [savingRow, setSavingRow]   = useState(false)
  const [confirmRemove, setConfirmRemove]   = useState<string | null>(null)
  const [removing, setRemoving]             = useState<string | null>(null)
  const [confirmInviteAll, setConfirmInviteAll] = useState(false)
  const [invitingAll, setInvitingAll]           = useState(false)
  const [photoTarget, setPhotoTarget] = useState<{ type: 'member' | 'pending'; id: string; name: string; hasPhoto: boolean; avatarUrl: string | null } | null>(null)
  const [locations, setLocations]     = useState<{ id: string; name: string }[]>([])
  const [locationFilter, setLocationFilter] = useState('')
  const [activePage, setActivePage]   = useState(1)
  const [pendingPage, setPendingPage] = useState(1)
  const [showAllActive, setShowAllActive]   = useState(false)
  const [showAllPending, setShowAllPending] = useState(false)
  const [locationSort, setLocationSort]     = useState<'asc' | 'desc' | null>(null)
  const PAGE_SIZE = 10

  function toggleLocationSort() {
    setLocationSort(s => s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc')
  }

  function locationName(id: string | null) {
    return id ? (locations.find(l => l.id === id)?.name ?? '') : ''
  }

  function sortByLocation<T extends { default_location_id: string | null }>(rows: T[]): T[] {
    if (!locationSort) return rows
    const dir = locationSort === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const an = locationName(a.default_location_id)
      const bn = locationName(b.default_location_id)
      if (!an && !bn) return 0
      if (!an) return 1
      if (!bn) return -1
      return an.localeCompare(bn) * dir
    })
  }

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/members/details')
    setMembers(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])
  useEffect(() => { setActivePage(1); setPendingPage(1) }, [search, locationFilter])

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

  // ── Edit row ───────────────────────────────────────────────────────────────

  async function saveRow(memberId: string) {
    if (!editingRow) return
    setSavingRow(true)
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:           editingRow.full_name.trim() || null,
        email:               editingRow.email.trim(),
        company_id:          editingRow.company_id,
        default_location_id: editingRow.isActive ? (editingRow.default_location_id || null) : undefined,
      }),
    })
    if (res.ok) {
      toast.success('Member updated')
      setEditingRow(null)
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSavingRow(false)
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
  const filtered = members.filter(m => {
    if (m.is_active === false) return false
    if (q && !m.email.toLowerCase().includes(q) && !(m.full_name ?? '').toLowerCase().includes(q) && !m.company_name.toLowerCase().includes(q)) return false
    if (locationFilter && m.default_location_id !== locationFilter) return false
    return true
  })

  const active      = sortByLocation(filtered.filter(m => !!m.accepted_at))
  const pending     = sortByLocation(
    filtered.filter(m => !m.accepted_at)
      .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))
  )
  const notInvited  = members.filter(m => m.is_active !== false && !m.accepted_at && !m.invite_token)

  const activeTotalPages  = Math.max(1, Math.ceil(active.length / PAGE_SIZE))
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE))
  const pagedActive  = showAllActive  ? active  : active.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const pagedPending = showAllPending ? pending : pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE)

  // ── Shared edit form ───────────────────────────────────────────────────────

  function EditForm({ m, colSpan }: { m: MemberRow; colSpan: number }) {
    if (!editingRow || editingRow.id !== m.id) return null
    return (
      <tr className="border-b border-gray-100 bg-blue-50/30">
        <td colSpan={colSpan} className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Name"
              value={editingRow.full_name}
              onChange={e => setEditingRow(r => r ? { ...r, full_name: e.target.value } : r)}
              className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <input
              type="email"
              placeholder="Email"
              value={editingRow.email}
              onChange={e => setEditingRow(r => r ? { ...r, email: e.target.value } : r)}
              className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
            <select
              value={editingRow.company_id}
              onChange={e => setEditingRow(r => r ? { ...r, company_id: e.target.value } : r)}
              className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {locations.length > 0 && (
              <select
                value={editingRow.default_location_id}
                onChange={e => setEditingRow(r => r ? { ...r, default_location_id: e.target.value } : r)}
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No default location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <button onClick={() => saveRow(m.id)} disabled={savingRow}
              className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
              {savingRow ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditingRow(null)}
              className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

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
          <NextLink href="/dashboard/admin/members/inactive"
            className="flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors">
            <Users size={14} /> Show Inactive Members
          </NextLink>
          <button onClick={() => { setShowForm(v => !v); setLastInviteLink(null) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Member
          </button>
        </div>
      </div>

      {/* TEMPORARY — remove this banner once the uninvited backlog is cleared */}
      {notInvited.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 border border-dashed border-amber-300 rounded-lg px-3.5 py-2.5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex-shrink-0">
            <Send size={12} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-900">Temporary — delete this banner once cleared</p>
            <p className="text-xs text-amber-700">{notInvited.length} members have never been invited</p>
          </div>
          {confirmInviteAll ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-amber-800 font-medium">Send {notInvited.length} invites?</span>
              <button onClick={handleInviteAll}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2.5 py-1.5 rounded-md">
                Yes, send
              </button>
              <button onClick={() => setConfirmInviteAll(false)}
                className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmInviteAll(true)} disabled={invitingAll}
              className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-md flex-shrink-0 disabled:opacity-50">
              {invitingAll ? 'Sending…' : `Invite Uninvited (${notInvited.length})`}
            </button>
          )}
        </div>
      )}

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

      {/* Search + Location filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Search by name, email, or company…" />
        </div>
        {locations.length > 0 && (
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      {/* Active members */}
      {active.length > 0 && (
        <Section title={`Active Members (${active.length})`} footer={
          <Pagination page={activePage} totalPages={activeTotalPages} onPageChange={setActivePage}
            showAll={showAllActive} onToggleShowAll={() => setShowAllActive(v => !v)} />
        }>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[15%]" /><col className="w-[20%]" /><col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th sortDir={locationSort} onClick={toggleLocationSort}>Location</Th><Th>Admin</Th><Th>Joined</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pagedActive.map(m => (
                editingRow?.id === m.id
                  ? <EditForm key={m.id} m={m} colSpan={7} />
                  : (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 truncate" title={m.full_name ?? undefined}>{m.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 truncate" title={m.email}>{m.email}</td>
                      <td className="px-4 py-3 text-gray-600 truncate" title={m.company_name}>{m.company_name}</td>
                      <td className="px-4 py-3 text-gray-600 truncate text-xs">
                        {m.default_location_id ? (locations.find(l => l.id === m.default_location_id)?.name ?? '—') : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {m.is_admin
                          ? <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Shield size={10} /> Admin</span>
                          : <span className="text-xs text-gray-400">Member</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(new Date(m.accepted_at!))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconAction
                            icon={Edit2}
                            label="Edit member"
                            onClick={() => setEditingRow({ id: m.id, full_name: m.full_name ?? '', email: m.email, company_id: m.company_id, default_location_id: m.default_location_id ?? '', isActive: true })}
                            colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          />
                          {m.user_id && (
                            <IconAction
                              icon={Camera}
                              label={m.avatar_url ? 'Photo linked' : 'Add picture'}
                              onClick={() => setPhotoTarget({ type: 'member', id: m.user_id!, name: m.full_name ?? m.email, hasPhoto: !!m.avatar_url, avatarUrl: m.avatar_url })}
                              colorClass={m.avatar_url ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}
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
                  )
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
              <col className="w-[15%]" /><col className="w-[20%]" /><col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th>Location</Th><Th>Status</Th><Th>Added</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pagedPending.map(m => (
                editingRow?.id === m.id
                  ? <EditForm key={m.id} m={m} colSpan={7} />
                  : (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 truncate" title={m.full_name ?? undefined}>
                        {m.full_name ?? <span className="text-gray-400 italic">No name</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 truncate" title={m.email}>{m.email}</td>
                      <td className="px-4 py-3 text-gray-600 truncate" title={m.company_name}>{m.company_name}</td>
                      <td className="px-4 py-3 text-gray-600 truncate text-xs">
                        {m.default_location_id ? (locations.find(l => l.id === m.default_location_id)?.name ?? '—') : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge m={m} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(new Date(m.invited_at))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconAction
                            icon={Edit2}
                            label="Edit member"
                            onClick={() => setEditingRow({ id: m.id, full_name: m.full_name ?? '', email: m.email, company_id: m.company_id, default_location_id: m.default_location_id ?? '', isActive: false })}
                            colorClass="text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          />
                          <IconAction
                            icon={Camera}
                            label={m.avatar_url ? 'Photo linked' : 'Add picture'}
                            onClick={() => setPhotoTarget({ type: 'pending', id: m.id, name: m.email, hasPhoto: !!m.avatar_url, avatarUrl: m.avatar_url })}
                            colorClass={m.avatar_url ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}
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
                              <span className="text-xs text-red-600">Uninvite?</span>
                              <button onClick={() => handleRemove(m.id)} disabled={removing === m.id}
                                className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                                {removing === m.id ? '…' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-400">No</button>
                            </div>
                          ) : (
                            <IconAction
                              icon={Trash2}
                              label="Uninvite"
                              onClick={() => setConfirmRemove(m.id)}
                              colorClass="text-gray-400 hover:bg-red-50 hover:text-red-500"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
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
          hasPhoto={photoTarget.hasPhoto}
          avatarUrl={photoTarget.avatarUrl}
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
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs rounded-b-xl">
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
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <h2 className="text-sm font-semibold text-blue-600">{title}</h2>
      </div>
      {children}
      {footer}
    </div>
  )
}

function Th({ children, sortDir, onClick }: { children?: React.ReactNode; sortDir?: 'asc' | 'desc' | null; onClick?: () => void }) {
  if (!onClick) {
    return <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">{children}</th>
  }
  const Icon = sortDir === 'asc' ? ArrowUp : sortDir === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">
      <button onClick={onClick} className="flex items-center gap-1 hover:text-gray-700">
        {children} <Icon size={11} />
      </button>
    </th>
  )
}
