'use client'

import { useState } from 'react'
import Link from 'next/link'

type Member = { id: string; full_name: string; avatar_url: string | null }
type Group = { key: string; name: string; members: Member[] }

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default function HausSmilesTabs({ groups }: { groups: Group[] }) {
  const [activeKey, setActiveKey] = useState(groups[0]?.key)
  const active = groups.find(g => g.key === activeKey) ?? groups[0]

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
          <Link key={member.id} href={`/dashboard/haus-smiles/${member.id}`} className="text-center group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.avatar_url ?? ''}
              alt={member.full_name}
              className="w-full aspect-square object-cover rounded-lg border border-gray-200 mb-2 group-hover:opacity-80 transition-opacity"
            />
            <p className="text-sm text-gray-700">{firstNameLastInitial(member.full_name)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
