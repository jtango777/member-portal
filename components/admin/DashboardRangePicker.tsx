'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const RANGES = [
  { key: '1m', label: 'This month' },
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: '12m', label: 'Last 12 months' },
]

export default function DashboardRangePicker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('range') ?? '1m'

  function handleClick(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === '1m') params.delete('range')
    else params.set('range', key)
    router.push(`/dashboard/admin?${params.toString()}`)
  }

  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      {RANGES.map(r => (
        <button
          key={r.key}
          onClick={() => handleClick(r.key)}
          className={cn(
            'px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors',
            current === r.key
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
