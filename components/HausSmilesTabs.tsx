'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Pencil, Search, User, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import AssignPhotoDialog from './admin/AssignPhotoDialog'
import ArchiveFaceDialog from './ArchiveFaceDialog'
import { getSeatingOptions } from '@/lib/seating'
import { linkedinUrl } from '@/lib/linkedin'

type Member = {
  id: string; full_name: string; avatar_url: string | null; seating?: string | null
  location_name?: string | null
  linkedin_username?: string | null
  hidden_from_faces?: boolean
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
  // Admin-only — the server already sends admins every row (hidden ones
  // included), so toggling this is instant, no page reload needed. Non-
  // admins never receive a hidden row in the first place, so this control
  // doesn't even render for them.
  const [showHidden, setShowHidden] = useState(false)
  const [togglingHidden, setTogglingHidden] = useState<string | null>(null)
  const active = groups.find(g => g.key === activeKey) ?? groups[0]
  const q = search.trim().toLowerCase()
  // showHidden switches the whole grid to a dedicated list of just the
  // hidden people (not the normal view with hidden ones dimmed and mixed
  // in) — a clean "who's hidden right now" list, not a jumbled combined
  // view. Click the toggle again to go back to the normal grid.
  const visibleMembers = active
    ? active.members
        .filter(m => showHidden ? m.hidden_from_faces : !m.hidden_from_faces)
        .filter(m => !seatingFilter || m.seating === seatingFilter)
        .filter(m => !q || m.full_name.toLowerCase().includes(q))
    : []
  const hiddenCountInActive = active ? active.members.filter(m => m.hidden_from_faces).length : 0

  async function toggleHidden(member: Member) {
    const nextHidden = !member.hidden_from_faces
    setTogglingHidden(member.id)
    const res = await fetch(`/api/admin/faces/${member.id}?source=${member.source}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: nextHidden }),
    })
    if (res.ok) {
      toast.success(nextHidden ? `${member.full_name.split(' ')[0]} hidden from Faces` : `${member.full_name.split(' ')[0]} showing on Faces again`)
      router.refresh()
    } else {
      toast.error('Could not update')
    }
    setTogglingHidden(null)
  }

  if (!active) {
    return <p className="text-sm text-gray-500">No photos yet — members will show up here as they add theirs.</p>
  }

  function selectLocation(key: string) {
    setActiveKey(key); setSeatingFilter(''); setSearch('')
    router.replace(`/dashboard/faces?location=${key}`, { scroll: false })
  }

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-gray-200 mb-6 pb-2 md:flex-row md:items-center md:justify-between md:pb-0">
        {/* Location tabs on desktop; a compact dropdown on mobile — the
            tab row (plus the search box's fixed width) didn't fit a phone
            screen, so the whole header quietly overflowed sideways
            instead of wrapping, leaving dead space on the right and
            forcing a horizontal scroll to reach the seating filter.
            Caught 2026-09-11. */}
        <select
          value={active.key}
          onChange={e => selectLocation(e.target.value)}
          className="md:hidden text-sm font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {groups.map(group => <option key={group.key} value={group.key}>{group.name}</option>)}
        </select>
        <div className="hidden md:flex gap-2">
          {groups.map(group => (
            <button
              key={group.key}
              onClick={() => selectLocation(group.key)}
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
        <div className="flex items-center gap-2 md:mb-2">
          <div className="relative flex-1 min-w-0 md:flex-none">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search names..."
              className="pl-7 pr-2.5 py-1.5 w-full md:w-40 text-sm border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={seatingFilter}
            onChange={e => setSeatingFilter(e.target.value)}
            className="flex-shrink-0 text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All seating</option>
            {getSeatingOptions(active.name).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Admin-only — lets a known-virtual member (or anyone else) be
              hidden from Faces without touching their actual account, via
              the eye icon on each card below. Off by default, same view
              as everyone else; toggling this reveals whatever's currently
              hidden, with a filled eye so it's obvious it's on. */}
          {isAdmin && hiddenCountInActive > 0 && (
            <button
              onClick={() => setShowHidden(v => !v)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                showHidden
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
              {showHidden ? `Showing ${hiddenCountInActive} hidden` : `${hiddenCountInActive} hidden`}
            </button>
          )}
        </div>
      </div>

      {showHidden && (
        <p className="text-xs text-gray-400 mb-3 -mt-1">
          Hidden from Faces — everyone else's view skips these entirely. Click the eye icon on a card to bring it back.
        </p>
      )}

      {visibleMembers.length === 0 && (
        <p className="text-sm text-gray-500">{showHidden ? 'No hidden faces match that filter.' : 'No one matches that filter yet.'}</p>
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
                {/* Light switch, not an archive — e.g. a known-virtual
                    member who shouldn't appear in a "who's physically
                    here" directory but stays fully active everywhere
                    else. Reversible from the same button. */}
                <button onClick={() => toggleHidden(member)}
                  disabled={togglingHidden === member.id}
                  title={member.hidden_from_faces ? 'Show on Faces' : 'Hide from Faces'}
                  className="p-1 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-amber-700 hover:bg-white disabled:opacity-50">
                  {member.hidden_from_faces ? <EyeOff size={13} /> : <Eye size={13} />}
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
              {/* No-photo members used to just be hidden from Faces
                  entirely — no incentive to add a photo if no one could
                  ever see you were missing one. Now they still show up,
                  as a plain gray placeholder linking to their own profile
                  same as everyone else, so it's visibly obvious to them
                  (and to admins looking through Faces) who hasn't added a
                  photo yet. Caught 2026-09-14. */}
              <Link href={`/dashboard/faces/${member.id}?location=${active.key}`}>
                {member.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.avatar_url}
                    alt={member.full_name}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200 block group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={`${member.full_name} — no photo yet`}
                    className="w-full aspect-square flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 group-hover:bg-gray-200 transition-colors"
                  >
                    <User size="40%" className="text-gray-400" strokeWidth={1.5} />
                  </div>
                )}
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
