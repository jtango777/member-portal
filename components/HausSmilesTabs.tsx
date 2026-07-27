'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Member = { id: string; full_name: string; avatar_url: string | null; seating?: string | null; source: 'profile' | 'directory' }
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
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const active = groups.find(g => g.key === activeKey) ?? groups[0]

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
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {groups.map(group => (
          <button
            key={group.key}
            onClick={() => setActiveKey(group.key)}
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

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {active.members.map(member => (
          <div key={member.id} className="relative group">
            {isAdmin && (
              confirmRemove === member.id ? (
                <div className="absolute inset-0 z-10 bg-white/95 rounded-lg border border-amber-200 flex flex-col items-center justify-center gap-2 p-2 text-center">
                  <p className="text-xs text-amber-700 font-medium">Archive from Faces?</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRemove(member)} disabled={removing === member.id}
                      className="text-xs bg-amber-600 text-white px-2 py-1 rounded font-medium">
                      {removing === member.id ? '…' : 'Yes'}
                    </button>
                    <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-500">No</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmRemove(member.id)}
                  title="Archive from Faces"
                  className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md bg-white/90 border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-amber-700 hover:bg-white transition-opacity">
                  <Trash2 size={13} />
                </button>
              )
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
    </div>
  )
}
