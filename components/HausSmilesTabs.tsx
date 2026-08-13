'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import AssignPhotoDialog from './admin/AssignPhotoDialog'
import { getSeatingOptions } from '@/lib/seating'

type Member = {
  id: string; full_name: string; avatar_url: string | null; seating?: string | null
  location_name?: string | null
  source: 'profile' | 'directory' | 'pending'
}
type Group = { key: string; name: string; members: Member[] }

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

type Props = { groups: Group[]; defaultLocationId?: string | null; isAdmin?: boolean }

export default function HausSmilesTabs({ groups, defaultLocationId, isAdmin }: Props) {
  const router = useRouter()
  const [activeKey, setActiveKey] = useState(
    groups.find(g => g.key === defaultLocationId)?.key ?? groups[0]?.key
  )
  const [seatingFilter, setSeatingFilter] = useState('')
  const [search, setSearch] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<Member | null>(null)
  const active = groups.find(g => g.key === activeKey) ?? groups[0]
  const q = search.trim().toLowerCase()
  const visibleMembers = active
    ? active.members
        .filter(m => !seatingFilter || m.seating === seatingFilter)
        .filter(m => !q || m.full_name.toLowerCase().includes(q))
    : []

  async function handleRemove(member: Member) {
    setRemoving(member.id)
    const res = await fetch(`/api/admin/haus-smiles/${member.id}?source=${member.source}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Archived')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to remove')
    }
    setConfirmRemove(null)
    setRemoving(null)
  }

  if (!active) {
    return <p className="text-sm text-gray-500">No photos yet — members will show up here as they add theirs.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 mb-6">
        <div className="flex gap-2">
          {groups.map(group => (
            <button
              key={group.key}
              onClick={() => { setActiveKey(group.key); setSeatingFilter(''); setSearch('') }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                group.key === active.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search names..."
              className="pl-7 pr-2.5 py-1.5 w-40 text-sm border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={seatingFilter}
            onChange={e => setSeatingFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All seating</option>
            {getSeatingOptions(active.name).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {visibleMembers.length === 0 && (
        <p className="text-sm text-gray-500">No one matches that filter yet.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {visibleMembers.map(member => (
          <div key={member.id} className="relative group">
            {isAdmin && (
              <>
                <div className={`absolute inset-0 z-10 bg-white/95 rounded-lg border border-red-200 flex flex-col items-center justify-center gap-1.5 p-2 text-center transition-all duration-150 ${
                  confirmRemove === member.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                }`}>
                  <p className="text-xs text-red-700 font-medium">Archive photo only?</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRemove(member)} disabled={removing === member.id}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                      {removing === member.id ? '…' : 'Yes'}
                    </button>
                    <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-500">No</button>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">Does not archive the user</p>
                </div>
                <div className={`absolute top-1.5 right-1.5 z-10 flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${
                  confirmRemove === member.id ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}>
                  <button onClick={() => setEditingPhoto(member)}
                    title="Change photo"
                    className="p-1 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-blue-700 hover:bg-white">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmRemove(member.id)}
                    title="Archive from Faces"
                    className="p-1 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-red-700 hover:bg-white">
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
            <Link href={`/dashboard/haus-smiles/${member.id}`} className="text-center block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={member.avatar_url ?? ''}
                alt={member.full_name}
                className="w-full aspect-square object-cover rounded-lg border border-gray-200 mb-2 group-hover:opacity-80 transition-opacity"
              />
              <p className="text-sm text-gray-700">{firstNameLastInitial(member.full_name)}</p>
              {member.seating && <p className="text-xs text-gray-400">{member.seating}</p>}
            </Link>
          </div>
        ))}
      </div>

      {editingPhoto && (
        <AssignPhotoDialog
          open
          onOpenChange={v => { if (!v) setEditingPhoto(null) }}
          onSuccess={() => { setEditingPhoto(null); router.refresh() }}
          targetType={editingPhoto.source === 'profile' ? 'member' : editingPhoto.source === 'pending' ? 'pending' : 'directory'}
          targetId={editingPhoto.id}
          memberName={editingPhoto.full_name}
          hasPhoto
          avatarUrl={editingPhoto.avatar_url}
        />
      )}
    </div>
  )
}
