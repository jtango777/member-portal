'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { DESK_NAME_MAX, type DeskPlan, type DeskSeat } from '@/lib/deskPlans'
import podsImage from '@/assets/floor-plans/el-segundo-main-pods.png'
import buildingImage from '@/assets/floor-plans/el-segundo-main-building.png'

// The El Segundo pods with a name box on every desk. Each box sits over its
// chair: the rooms are too narrow to fit a ten-character box beside a chair
// without it running into the next pod's boxes (Joe, 2026-10-21).
//
// Saves when a box loses focus or on Enter; Escape puts back what was there.
// The image is imported rather than served from /public so the plan is not
// sitting at a guessable public address.

// Wide enough for ten characters in every box; narrower screens scroll.
const MIN_WIDTH = 960
// Box size as a share of the image, so boxes scale with it.
const BOX_W = 0.088
const BOX_H = 0.034

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function DeskMap({ plan, initialNames }: { plan: DeskPlan; initialNames: Record<string, string> }) {
  const [saved, setSaved]   = useState<Record<string, string>>(initialNames)
  const [drafts, setDrafts] = useState<Record<string, string>>(initialNames)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [showBuilding, setShowBuilding] = useState(false)

  const seatCount = plan.pods.reduce((n, p) => n + p.seats.length, 0)
  const assigned  = Object.values(saved).filter(Boolean).length

  async function save(seat: DeskSeat) {
    const name = (drafts[seat.id] ?? '').trim()
    if (name === (saved[seat.id] ?? '')) {
      setDrafts(d => ({ ...d, [seat.id]: name }))
      return
    }
    setStatus(s => ({ ...s, [seat.id]: 'saving' }))
    try {
      const res = await fetch('/api/admin/desk-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id, desk: seat.id, name }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Could not save that desk.')
      setSaved(s => ({ ...s, [seat.id]: name }))
      setDrafts(d => ({ ...d, [seat.id]: name }))
      setStatus(s => ({ ...s, [seat.id]: 'saved' }))
      setTimeout(() => setStatus(s => (s[seat.id] === 'saved' ? { ...s, [seat.id]: 'idle' } : s)), 1500)
    } catch (err) {
      setStatus(s => ({ ...s, [seat.id]: 'error' }))
      toast.error(`Desk ${seat.id}: ${err instanceof Error ? err.message : 'Could not save.'}`)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Desk assignments · {plan.title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Type a name in a desk&apos;s box to assign it, or clear the box to free it. Changes save as you leave the box.
          </p>
        </div>
        <p className="text-xs text-gray-500 tabular-nums">{assigned} of {seatCount} desks assigned</p>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="relative mx-auto" style={{ minWidth: MIN_WIDTH, aspectRatio: `${plan.width} / ${plan.height}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={podsImage.src} alt={`Floor plan of pods ${plan.pods[0].number}–${plan.pods[plan.pods.length - 1].number}`}
            className="absolute inset-0 w-full h-full select-none" draggable={false} />
          {plan.pods.flatMap(p => p.seats).map(seat => {
            const st = status[seat.id] ?? 'idle'
            return (
              <input
                key={seat.id}
                type="text"
                value={drafts[seat.id] ?? ''}
                maxLength={DESK_NAME_MAX}
                placeholder={seat.id}
                aria-label={`Desk ${seat.id}`}
                title={`Desk ${seat.id}`}
                onChange={e => setDrafts(d => ({ ...d, [seat.id]: e.target.value }))}
                onBlur={() => save(seat)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    setDrafts(d => ({ ...d, [seat.id]: saved[seat.id] ?? '' }))
                    setStatus(s => ({ ...s, [seat.id]: 'idle' }))
                  }
                }}
                style={{
                  position: 'absolute',
                  left:   `${(seat.x / plan.width - BOX_W / 2) * 100}%`,
                  top:    `${(seat.y / plan.height - BOX_H / 2) * 100}%`,
                  width:  `${BOX_W * 100}%`,
                  height: `${BOX_H * 100}%`,
                }}
                className={cn(
                  'rounded px-1 text-xs text-center text-gray-900 shadow-sm outline-none transition-colors',
                  'placeholder:text-gray-300 focus:ring-2 focus:ring-blue-500',
                  drafts[seat.id] ? 'bg-white font-medium' : 'bg-white/80',
                  st === 'saving' ? 'border border-amber-400'
                    : st === 'saved' ? 'border border-emerald-500'
                    : st === 'error' ? 'border-2 border-red-500'
                    : 'border border-gray-300',
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-gray-100">
        <button onClick={() => setShowBuilding(v => !v)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
          {showBuilding ? 'Hide' : 'Show'} the whole building
        </button>
        {showBuilding && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={buildingImage.src} alt="Floor plan of the El Segundo main building" className="mt-3 w-full h-auto rounded border border-gray-100" />
        )}
      </div>
    </div>
  )
}
