'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Pencil, Search } from 'lucide-react'
import AssignPhotoDialog from './admin/AssignPhotoDialog'
import ArchiveFaceDialog from './ArchiveFaceDialog'
import { getSeatingOptions } from '@/lib/seating'
import { linkedinUrl } from '@/lib/linkedin'

type Member = {
  id: string; full_name: string; avatar_url: string | null; seating?: string | null
  location_name?: string | null
  linkedin_username?: string | null
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
  const searchParams = useSearchParams()
  // The URL is the source of truth for which location tab is active — a
  // returning navigation (the "Back to Faces" link, or the browser's own
  // back button) fully remounts this component, so anything kept only in
  // local state (the old behavior) was lost and silently replaced by the
  // viewer's home location every time. Prefer whatever's in the URL, and
  // only fall back to the home-location default when there isn't one.
  const urlLocation = searchParams.get('location')
  const [activeKey, setActiveKey] = useState(
    groups.find(g => g.key === urlLocation)?.key
      ?? groups.find(g => g.key === defaultLocationId)?.key
      ?? groups[0]?.key
  )
  const [seatingFilter, setSeatingFilter] = useState('')
  const [search, setSearch] = useState('')
  const [archiveTarget, setArchiveTarget] = useState<Member | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<Member | null>(null)
  const active = groups.find(g => g.key === activeKey) ?? groups[0]
  const q = search.trim().toLowerCase()
  const visibleMembers = active
    ? active.members
        .filter(m => !seatingFilter || m.seating === seatingFilter)
        .filter(m => !q || m.full_name.toLowerCase().includes(q))
    : []

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
              onClick={() => {
                setActiveKey(group.key); setSeatingFilter(''); setSearch('')
                router.replace(`/dashboard/faces?location=${group.key}`, { scroll: false })
              }}
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
              <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <button onClick={() => setEditingPhoto(member)}
                  title="Change photo"
                  className="p-1 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-blue-700 hover:bg-white">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setArchiveTarget(member)}
                  title="Archive from Faces"
                  className="p-1 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-red-700 hover:bg-white">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
            {/* Own relative wrapper just for the photo, separate from the
                text below — the LinkedIn badge needs to sit in the photo's
                own corner regardless of how tall the name/seating text
                ends up, and it can't be nested inside the profile Link
                below since it's itself a link (out to LinkedIn, not the
                profile page) — nested <a> tags aren't valid. */}
            <div className="relative mb-2">
              <Link href={`/dashboard/faces/${member.id}?location=${active.key}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.avatar_url ?? ''}
                  alt={member.full_name}
                  className="w-full aspect-square object-cover rounded-lg border border-gray-200 block group-hover:opacity-80 transition-opacity"
                />
              </Link>
              {member.linkedin_username && (
                <a
                  href={linkedinUrl(member.linkedin_username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="LinkedIn"
                  onClick={e => e.stopPropagation()}
                  className="absolute bottom-1 right-1 z-20 flex items-center justify-center w-5 h-5 rounded-[5px] bg-[#0A66C2] shadow-sm hover:scale-110 transition-transform"
                >
                  {/* LinkedIn's real "in" app icon: solid blue rounded
                      square, white glyph directly on it — no inner circle.
                      (Two earlier passes: plain outline icon, then an
                      overcomplicated circle-in-square version — this is
                      the actual simple mark.) */}
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="white">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
                  </svg>
                </a>
              )}
            </div>
            <Link href={`/dashboard/faces/${member.id}?location=${active.key}`} className="text-center block">
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

      <ArchiveFaceDialog
        face={archiveTarget ? { id: archiveTarget.id, source: archiveTarget.source, name: archiveTarget.full_name.split(' ')[0] } : null}
        onOpenChange={v => { if (!v) setArchiveTarget(null) }}
        onSuccess={() => { setArchiveTarget(null); router.refresh() }}
      />
    </div>
  )
}
