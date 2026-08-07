'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

// Shared table scaffold for admin list pages (Members, Companies, ...).
// The whole point of this file existing is that "table-fixed + an explicit
// colgroup" is what keeps columns from shifting when the visible rows
// change (pagination, filtering) or drifting out of alignment between two
// separately hand-copied tables — that exact bug has hit both Members and
// Companies independently. Sharing one component means there's only one
// place this mechanism can break, not N copies that can silently diverge.
export function AdminTable({ colWidths, minWidth = 900, children }: {
  colWidths: string[]
  minWidth?: number
  children: React.ReactNode
}) {
  return (
    <table className="w-full text-sm table-fixed" style={{ minWidth }}>
      <colgroup>
        {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
      </colgroup>
      {children}
    </table>
  )
}

export function Th({ children, sortDir, onClick }: {
  children?: React.ReactNode
  sortDir?: 'asc' | 'desc' | null
  onClick?: () => void
}) {
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

// Standard cell treatments, so "which columns truncate/nowrap" doesn't have
// to be independently re-decided (and potentially gotten wrong) per table.
export const tdTruncate = 'px-4 py-3 truncate'
export const tdNowrap   = 'px-4 py-3 whitespace-nowrap'
export const tdBase     = 'px-4 py-3'
