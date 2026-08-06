'use client'

import { useState, useRef, useEffect } from 'react'
import { Company } from '@/types'
import { Search, ChevronDown } from 'lucide-react'

const NONE_LABEL = 'No company (individual)'

type Props = {
  companies: Company[]
  value: string // company id, or '' for none
  onChange: (id: string) => void
  className?: string
}

// A searchable dropdown for picking a company out of a long list — a plain
// <select> gets unwieldy once there are hundreds of companies to scroll
// through. Always offers "No company (individual)" as the top option.
export default function CompanyCombobox({ companies, value, onChange, className }: Props) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = companies.find(c => c.id === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const q = query.trim().toLowerCase()
  const filteredCompanies = q
    ? companies.filter(c => c.name.toLowerCase().includes(q))
    : companies
  const showNoneOption = !q || NONE_LABEL.toLowerCase().includes(q)

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0) }}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <span className={selected ? 'text-gray-900 truncate' : 'text-gray-500 truncate'}>
          {selected ? selected.name : NONE_LABEL}
        </span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search companies…"
              className="w-full text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {showNoneOption && (
              <button
                type="button"
                onClick={() => select('')}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${!value ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
              >
                {NONE_LABEL}
              </button>
            )}
            {filteredCompanies.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 truncate ${c.id === value ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
              >
                {c.name}
              </button>
            ))}
            {!showNoneOption && filteredCompanies.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">No companies match "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
