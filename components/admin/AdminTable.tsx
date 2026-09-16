'use client'

import { useState, useEffect } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

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

export function Th({ children, sortDir, onClick, hideIdleSortIcon }: {
  children?: React.ReactNode
  sortDir?: 'asc' | 'desc' | null
  onClick?: () => void
  // Sortable, but no ↑↓ hint until it's actually the active sort — for a
  // column where the idle arrows read as clutter (Caroline, 2026-09-16).
  hideIdleSortIcon?: boolean
}) {
  if (!onClick) {
    return <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">{children}</th>
  }
  const Icon = sortDir === 'asc' ? ArrowUp : sortDir === 'desc' ? ArrowDown : ArrowUpDown
  const showIcon = sortDir ? true : !hideIdleSortIcon
  return (
    <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">
      {/* uppercase repeated here: the <button> doesn't inherit the th's
          text-transform, so sortable headers rendered in title case while
          plain ones were ALL CAPS (spotted 2026-09-16). */}
      <button onClick={onClick} className="flex items-center gap-1 hover:text-gray-700 uppercase tracking-wide">
        {children} {showIcon && <Icon size={11} />}
      </button>
    </th>
  )
}

// Standard cell treatments, so "which columns truncate/nowrap" doesn't have
// to be independently re-decided (and potentially gotten wrong) per table.
export const tdTruncate = 'px-4 py-3 truncate'
export const tdNowrap   = 'px-4 py-3 whitespace-nowrap'
export const tdBase     = 'px-4 py-3'

// Shared row-action button — icon only, grey until hovered (colorClass
// supplies the hover state, e.g. red for a destructive action), with a
// tooltip for the label instead of visible text. One pattern for every
// admin table's Actions column instead of each one inventing its own
// (text+icon, always-colored, etc.) — that's what made Members and
// Companies look inconsistent for no real reason.
export function IconAction({ icon: Icon, label, onClick, disabled, colorClass }: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  colorClass: string
}) {
  // Used to be a custom CSS tooltip (absolutely positioned span, shown on
  // hover) instead of the browser's native one — looked nicer, but it's
  // just laid out in the DOM like anything else, so any ancestor that
  // clips overflow (the reservation modal's scrollable body, in
  // particular) cut it off mid-word instead of showing the full label.
  // The native `title` attribute renders in its own browser-level layer,
  // so it can't be clipped by any container on the page. Caught 2026-09-11.
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${colorClass}`}>
      <Icon size={14} />
    </button>
  )
}

// Shared "list header" shell — title/count on the left, Pagination (or
// anything else) on the right. Same look every place we show a list, so
// admin pages read as one system instead of each list inventing its own
// header/pagination layout.
export function Section({ title, children, headerRight }: { title: string; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-blue-600">{title}</h2>
        {headerRight}
      </div>
      <div className="overflow-x-auto overflow-y-hidden">{children}</div>
    </div>
  )
}

export function Pagination({ page, totalPages, onPageChange, showAll, onToggleShowAll, pageSize, onPageSizeChange }: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  showAll: boolean
  onToggleShowAll: () => void
  pageSize: number
  onPageSizeChange: (size: number) => void
}) {
  return (
    <div className="flex items-center gap-3 text-xs flex-shrink-0">
      <button onClick={onToggleShowAll} className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
        {showAll ? `Show ${pageSize} per page` : 'Show all'}
      </button>
      {!showAll && (
        <label className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
          Per page:
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      {!showAll && totalPages > 1 && (
        <div className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
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

// All the page/pageSize/showAll bookkeeping a paginated list needs, in one
// place — every list on an admin page should look and behave the same way
// (Section + Pagination above), and that only stays true if they all pull
// from the same hook instead of each re-deriving it slightly differently.
export function usePagedList<T>(rows: T[], initialPageSize = 10) {
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [showAll, setShowAll]   = useState(false)

  // Row-set changed size (filtered, refreshed, tab switched) — snap back to
  // page 1 rather than stranding the user on a now-out-of-range page.
  useEffect(() => { setPage(1) }, [rows.length])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const paged = showAll ? rows : rows.slice((page - 1) * pageSize, page * pageSize)

  return {
    paged,
    paginationProps: {
      page, totalPages, onPageChange: setPage,
      showAll, onToggleShowAll: () => setShowAll(v => !v),
      pageSize, onPageSizeChange: (size: number) => { setPageSize(size); setPage(1) },
    },
  }
}
