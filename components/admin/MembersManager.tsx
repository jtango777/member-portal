'use client'

import { useState, useEffect, useCallback } from 'react'
import NextLink from 'next/link'
import { Company, MembershipType } from '@/types'
import { Plus, Send, Check, Shield, Download, Copy, Link, Search, Edit2, Trash2, X, Camera, Users, DoorOpen } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import { useAutoScrollIntoView } from '@/lib/useAutoScrollIntoView'
import toast from 'react-hot-toast'
import AssignPhotoDialog from '@/components/admin/AssignPhotoDialog'
import CompanyCombobox from '@/components/admin/CompanyCombobox'
import EditMemberDialog from '@/components/admin/EditMemberDialog'
import { AdminTable, Th, Section, Pagination } from '@/components/admin/AdminTable'
import { getSeatingOptions } from '@/lib/seating'

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
      {/* Above, not below — the table wrapper clips vertical overflow (to
          kill an unrelated scrollbar bug), which cut this off whenever it's
          the last (or only) row. */}
      <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  )
}

type MemberRow = {
  id:                    string
  email:                 string
  company_id:            string | null
  suggested_company_id:   string | null
  suggested_company_name: string | null
  company_name:          string
  individual_hours_allotment: number | null
  invited_at:            string
  accepted_at:           string | null
  invite_token:          string | null
  user_id:               string | null
  full_name:             string | null
  first_name:            string | null
  last_name:             string | null
  is_admin:              boolean
  avatar_url:            string | null
  default_location_id:   string | null
  seating:               string | null
  room_access_requested_at: string | null
  is_active:             boolean
}

function companyOrTypeLabel(m: Pick<MemberRow, 'company_name' | 'individual_hours_allotment'>) {
  if (m.company_name) return m.company_name
  if (m.individual_hours_allotment) return `${m.individual_hours_allotment}h/month (individual)`
  return '—'
}

// Company only matters for people sharing an hour pool with others — a
// standalone individual can instead carry a membership type directly, and
// "Private Office" is a company-only concept (per-office, not per-person),
// so it's left out of this list. Used by the Add Member form's Room Hours field.
function individualMembershipTypes(types: MembershipType[]) {
  return types.filter(t => t.hours_per_month != null)
}

function pooledHoursLabel(companies: Company[], companyId: string) {
  const hours = companies.find(c => c.id === companyId)?.monthly_hours_allotment ?? 0
  return `${hours}h/month (pooled with company)`
}

type Props = { companies: Company[]; membershipTypes: MembershipType[] }

export default function MembersManager({ companies, membershipTypes }: Props) {
  const [members, setMembers]       = useState<MemberRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  // Same settle-after-animating trick as roomsPanelSettled below, but for
  // the whole Add Member card appearing/disappearing.
  const [formPanelSettled, setFormPanelSettled] = useState(false)
  const formRef = useAutoScrollIntoView<HTMLDivElement>(showForm)
  const [email, setEmail]           = useState('')
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName]   = useState('')
  const [connectToRooms, setConnectToRooms] = useState(false)
  const connectToRoomsRef = useAutoScrollIntoView<HTMLDivElement>(connectToRooms)
  // Tracks whether the expand animation has finished — the panel needs
  // overflow-hidden while animating open (so the height transition looks
  // right) but that same overflow-hidden clips the Company search popover
  // once it's actually open, so we lift it after the transition settles.
  const [roomsPanelSettled, setRoomsPanelSettled] = useState(false)
  const [companyId, setCompanyId]           = useState('')
  const [individualHours, setIndividualHours] = useState('')
  const [addLocationId, setAddLocationId]   = useState('')
  const [addSeating, setAddSeating]         = useState('')
  const [sending, setSending]       = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin]   = useState<string | null>(null)
  const [resending, setResending]   = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<MemberRow | null>(null)
  const [accessTarget, setAccessTarget] = useState<MemberRow | null>(null)
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
  const [activePageSize, setActivePageSize]   = useState(10)
  const [pendingPageSize, setPendingPageSize] = useState(10)
  const [locationSort, setLocationSort]     = useState<'asc' | 'desc' | null>(null)

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

  // Match the panel's expand transition duration (300ms) below
  useEffect(() => {
    if (!connectToRooms) { setRoomsPanelSettled(false); return }
    const t = setTimeout(() => setRoomsPanelSettled(true), 300)
    return () => clearTimeout(t)
  }, [connectToRooms])

  useEffect(() => {
    if (!showForm) { setFormPanelSettled(false); return }
    const t = setTimeout(() => setFormPanelSettled(true), 300)
    return () => clearTimeout(t)
  }, [showForm])

  // ── Add member ─────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent, skipEmail = false) {
    e.preventDefault()
    setSending(true)
    setLastInviteLink(null)
    const res  = await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name: addFirstName.trim() || null,
        last_name: addLastName.trim() || null,
        company_id: companyId || null,
        individual_hours_allotment: individualHours !== '' ? Number(individualHours) : null,
        default_location_id: addLocationId || null,
        seating: addSeating || null,
        skipEmail,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed')
    } else {
      if (skipEmail) toast.success('Member added — no invite sent.')
      else if (data.emailSent) toast.success('Invite sent!')
      else { setLastInviteLink(data.inviteLink); toast.success('Member added — copy the link below to invite them manually.') }
      setEmail('')
      setAddFirstName('')
      setAddLastName('')
      setConnectToRooms(false)
      setCompanyId('')
      setIndividualHours('')
      setAddLocationId('')
      setAddSeating('')
      await refresh()
    }
    setSending(false)
  }

  // ── Resend / get link ──────────────────────────────────────────────────────

  async function handleResend(memberId: string) {
    // A member added via "Add to Pending" has never actually been sent
    // anything (invite_token is null) — this is their first invite, not a
    // resend, and the toast should say so.
    const isFirstInvite = !members.find(m => m.id === memberId)?.invite_token
    setResending(memberId)
    const res  = await fetch('/api/invites/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.emailSent) toast.success(isFirstInvite ? 'Invite sent!' : 'Invite resent!')
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


  // ── Remove member ──────────────────────────────────────────────────────────

  async function handleRemove(memberId: string) {
    setRemoving(memberId)
    const res = await fetch(`/api/admin/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Archived')
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
      Company:      companyOrTypeLabel(m),
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
    if (q && !m.email.toLowerCase().includes(q) && !(m.full_name ?? '').toLowerCase().includes(q) && !companyOrTypeLabel(m).toLowerCase().includes(q)) return false
    if (locationFilter && m.default_location_id !== locationFilter) return false
    return true
  })

  const active      = sortByLocation(filtered.filter(m => !!m.accepted_at))
  const pending     = sortByLocation(
    filtered.filter(m => !m.accepted_at)
      .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))
  )
  const notInvited  = members.filter(m => m.is_active !== false && !m.accepted_at && !m.invite_token)
  // Registered members who hit "Register for Rooms" but still have no
  // company or Room Hours assigned — i.e. their request hasn't been
  // granted yet. Sorted oldest-request-first so the longest wait surfaces.
  const roomAccessRequests = members
    .filter(m => m.is_active !== false && !!m.room_access_requested_at && !m.company_id && !m.individual_hours_allotment)
    .sort((a, b) => new Date(a.room_access_requested_at!).getTime() - new Date(b.room_access_requested_at!).getTime())

  // Opens the edit dialog directly — no need to scroll to the row anymore
  // since editing happens in a modal, not inline in the table.
  function jumpToMember(m: MemberRow) {
    setEditTarget(m)
  }

  // True room access means actual bookable hours right now — a company
  // assigned with a 0h pool (e.g. a placeholder company) doesn't count,
  // same distinction that caused Ani Boyo to look "set up" but not
  // actually be able to book anything.
  function hasRoomAccess(m: MemberRow): boolean {
    if (m.individual_hours_allotment) return true
    if (!m.company_id) return false
    const company = companies.find(c => c.id === m.company_id)
    return (company?.monthly_hours_allotment ?? 0) > 0
  }

  const activeTotalPages  = Math.max(1, Math.ceil(active.length / activePageSize))
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / pendingPageSize))
  const pagedActive  = showAllActive  ? active  : active.slice((activePage - 1) * activePageSize, activePage * activePageSize)
  const pagedPending = showAllPending ? pending : pending.slice((pendingPage - 1) * pendingPageSize, pendingPage * pendingPageSize)

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
          <NextLink href="/dashboard/admin/members/inactive"
            className="flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors">
            <Users size={14} /> Show Archived Members
          </NextLink>
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
          <div className="grid flex-shrink-0">
            <div className={`col-start-1 row-start-1 flex items-center gap-2 transition-all duration-150 ${
              confirmInviteAll ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}>
              <span className="text-xs text-amber-800 font-medium whitespace-nowrap">Send {notInvited.length} invites?</span>
              <button onClick={handleInviteAll}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2.5 py-1.5 rounded-md">
                Yes, send
              </button>
              <button onClick={() => setConfirmInviteAll(false)}
                className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
            <button onClick={() => setConfirmInviteAll(true)} disabled={invitingAll}
              className={`col-start-1 row-start-1 justify-self-end flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-md disabled:opacity-50 transition-all duration-150 whitespace-nowrap ${
                confirmInviteAll ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
              }`}>
              <Send size={12} /> {invitingAll ? 'Sending…' : 'Invite All'}
            </button>
          </div>
        </div>
      )}

      {/* Members who clicked "Register for Rooms" but don't have access yet */}
      {roomAccessRequests.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex-shrink-0 mt-0.5">
            <DoorOpen size={12} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-900">
              {roomAccessRequests.length} {roomAccessRequests.length === 1 ? 'person is' : 'people are'} waiting for room access
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Click a name below to grant it:</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {roomAccessRequests.map(m => (
                <button key={m.id} onClick={() => jumpToMember(m)}
                  className="flex items-center gap-1.5 text-xs bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-medium pl-2 pr-2.5 py-1 rounded-md">
                  <Plus size={11} className="text-amber-600" /> {m.full_name ?? m.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add member form — always mounted so opening/closing animates
          smoothly via a grid-rows transition, instead of an abrupt
          mount/unmount (same trick as the Rooms panel inside it). */}
      <div ref={formRef} className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showForm ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className={`transition-opacity duration-200 ${showForm ? 'opacity-100 delay-100' : 'opacity-0'} ${formPanelSettled ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-50">
              <Users size={14} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Add New Member</h3>
          </div>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex gap-4">
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                <input type="text" value={addFirstName} onChange={e => setAddFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jane" />
              </div>
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                <input type="text" value={addLastName} onChange={e => setAddLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Smith" />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="w-72">
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="member@company.com" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none pb-2.5">
                <span className="relative inline-flex h-4 w-7 flex-shrink-0 items-center">
                  <input type="checkbox" checked={connectToRooms}
                    onChange={e => {
                      const checked = e.target.checked
                      setConnectToRooms(checked)
                      if (!checked) { setCompanyId(''); setIndividualHours('') }
                    }}
                    className="peer sr-only" />
                  <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors duration-200" />
                  <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3" />
                </span>
                <span className="text-sm text-gray-700">Connect to Rooms?</span>
              </label>
            </div>

            <div className="flex gap-4">
              <div className="w-72">
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <select value={addLocationId} onChange={e => { setAddLocationId(e.target.value); setAddSeating('') }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No default location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              {addLocationId && (
                <div className="w-72">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Seating</label>
                  <select value={addSeating} onChange={e => setAddSeating(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">No seating set</option>
                    {getSeatingOptions(locations.find(l => l.id === addLocationId)?.name).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Smoothly expands/collapses via a grid-rows transition instead of mounting/unmounting */}
            <div ref={connectToRoomsRef} className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${connectToRooms ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className={`transition-opacity duration-200 ${connectToRooms ? 'opacity-100 delay-100' : 'opacity-0'} ${roomsPanelSettled ? 'overflow-visible' : 'overflow-hidden'}`}>
                <div className="flex gap-4 pt-4 mt-1 border-t border-gray-100">
                  <div className="w-72">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                    <CompanyCombobox companies={companies} value={companyId} onChange={id => { setCompanyId(id); if (id) setIndividualHours('') }} />
                  </div>
                  <div className="w-72">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Room Hours</label>
                    {companyId ? (
                      <input type="text" disabled value={pooledHoursLabel(companies, companyId)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500" />
                    ) : (
                      <>
                        <input type="number" min="0" step="0.5" value={individualHours}
                          onChange={e => setIndividualHours(e.target.value)}
                          placeholder="e.g. 6"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {individualMembershipTypes(membershipTypes).map(t => (
                            <button key={t.id} type="button" onClick={() => setIndividualHours(String(t.hours_per_month))}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-md">
                              {t.name} ({t.hours_per_month}h)
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button type="submit" disabled={sending}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors">
                <Send size={13} /> {sending ? 'Saving…' : 'Add & Send Invite'}
              </button>
              <button type="button" disabled={sending} onClick={e => handleInvite(e as unknown as React.FormEvent, true)}
                className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                {sending ? 'Saving…' : 'Add to Pending'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setLastInviteLink(null) }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 transition-colors">Cancel</button>
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
        </div>
      </div>

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
        <Section title={`Active Members (${active.length})`} headerRight={
          <Pagination page={activePage} totalPages={activeTotalPages} onPageChange={setActivePage}
            showAll={showAllActive} onToggleShowAll={() => setShowAllActive(v => !v)}
            pageSize={activePageSize} onPageSizeChange={size => { setActivePageSize(size); setActivePage(1) }} />
        }>
          <AdminTable colWidths={['13%', '24%', '12%', '15%', '8%', '12%', '16%']} minWidth={1000}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th sortDir={locationSort} onClick={toggleLocationSort}>Location</Th><Th>Admin</Th><Th>Joined</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pagedActive.map((m, i) => (
                    <tr key={m.id} id={`member-row-${m.id}`} className={"border-b border-gray-100 last:border-0 hover:bg-gray-50"}>
                      <td className="px-4 py-2 font-medium text-gray-900 truncate" title={m.full_name ?? undefined}>
                        {m.full_name ?? '—'}
                        {m.room_access_requested_at && !m.company_id && !m.individual_hours_allotment && (
                          <span title="Requested room access" className="inline-flex items-center justify-center w-4 h-4 ml-1.5 rounded-full bg-amber-100 text-amber-700 align-middle">
                            <DoorOpen size={10} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 truncate" title={m.email}>{m.email}</td>
                      <td className="px-4 py-2 text-gray-600 truncate" title={companyOrTypeLabel(m)}>{companyOrTypeLabel(m)}</td>
                      <td className="px-4 py-2 text-gray-600 truncate text-xs">
                        {m.default_location_id ? (locations.find(l => l.id === m.default_location_id)?.name ?? '—') : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {m.is_admin
                          ? <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Shield size={10} /> Admin</span>
                          : <span className="text-xs text-gray-400">Member</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{formatShortDate(new Date(m.accepted_at!))}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconAction
                            icon={DoorOpen}
                            label={hasRoomAccess(m) ? 'Has room access — click to check' : 'No room access — click to grant'}
                            onClick={() => setAccessTarget(m)}
                            colorClass={hasRoomAccess(m) ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}
                          />
                          <IconAction
                            icon={Edit2}
                            label="Edit member"
                            onClick={() => setEditTarget(m)}
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
                              icon={Shield}
                              label={m.is_admin ? 'Admin — click to remove' : 'Not admin — click to grant'}
                              onClick={() => toggleAdmin(m.user_id!, m.is_admin)}
                              disabled={togglingAdmin === m.user_id}
                              colorClass={m.is_admin ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}
                            />
                          )}
                          {confirmRemove === m.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-red-700 whitespace-nowrap">Archive?</span>
                              <button onClick={() => handleRemove(m.id)} disabled={removing === m.id}
                                className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                                {removing === m.id ? '…' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-400">No</button>
                            </div>
                          ) : (
                            <IconAction
                              icon={Trash2}
                              label="Archive member"
                              onClick={() => setConfirmRemove(m.id)}
                              colorClass="text-gray-400 hover:bg-red-50 hover:text-red-600"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
              ))}
            </tbody>
          </AdminTable>
        </Section>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <Section title={`Pending (${pending.length})`} headerRight={
          <Pagination page={pendingPage} totalPages={pendingTotalPages} onPageChange={setPendingPage}
            showAll={showAllPending} onToggleShowAll={() => setShowAllPending(v => !v)}
            pageSize={pendingPageSize} onPageSizeChange={size => { setPendingPageSize(size); setPendingPage(1) }} />
        }>
          <AdminTable colWidths={['13%', '24%', '12%', '15%', '8%', '12%', '16%']} minWidth={1000}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Name</Th><Th>Email</Th><Th>Company</Th><Th>Location</Th><Th>Status</Th><Th>Added</Th><Th />
              </tr>
            </thead>
            <tbody>
              {pagedPending.map((m, i) => (
                    <tr key={m.id} className={"border-b border-gray-100 last:border-0 hover:bg-gray-50"}>
                      <td className="px-4 py-2 font-medium text-gray-900 truncate" title={m.full_name ?? undefined}>
                        {m.full_name ?? <span className="text-gray-400 italic">No name</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-700 truncate" title={m.email}>{m.email}</td>
                      <td className="px-4 py-2 text-gray-600 truncate" title={companyOrTypeLabel(m)}>{companyOrTypeLabel(m)}</td>
                      <td className="px-4 py-2 text-gray-600 truncate text-xs">
                        {m.default_location_id ? (locations.find(l => l.id === m.default_location_id)?.name ?? '—') : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2"><StatusBadge m={m} /></td>
                      <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{formatShortDate(new Date(m.invited_at))}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconAction
                            icon={DoorOpen}
                            label={hasRoomAccess(m) ? 'Has room access — click to check' : 'No room access — click to set up before they sign up'}
                            onClick={() => setAccessTarget(m)}
                            colorClass={hasRoomAccess(m) ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}
                          />
                          <IconAction
                            icon={Edit2}
                            label="Edit member"
                            onClick={() => setEditTarget(m)}
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
                            colorClass="text-amber-500 hover:bg-amber-50"
                          />
                          {confirmRemove === m.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-red-700">Archive?</span>
                              <button onClick={() => handleRemove(m.id)} disabled={removing === m.id}
                                className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                                {removing === m.id ? '…' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-400">No</button>
                            </div>
                          ) : (
                            <IconAction
                              icon={Trash2}
                              label="Archive member"
                              onClick={() => setConfirmRemove(m.id)}
                              colorClass="text-gray-400 hover:bg-red-50 hover:text-red-600"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
              ))}
            </tbody>
          </AdminTable>
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

      <EditMemberDialog
        member={editTarget ?? accessTarget}
        compact={!editTarget && !!accessTarget}
        onOpenChange={v => { if (!v) { setEditTarget(null); setAccessTarget(null) } }}
        onSuccess={refresh}
        companies={companies}
        membershipTypes={membershipTypes}
        locations={locations}
      />
    </div>
  )
}

function StatusBadge({ m }: { m: MemberRow }) {
  if (m.accepted_at)  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Check size={10} /> Active</span>
  if (m.invite_token) return <span className="whitespace-nowrap text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Invited</span>
  return <span className="whitespace-nowrap text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Not invited</span>
}

