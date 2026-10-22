'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { StaticImageData } from 'next/image'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DESK_NAME_MAX, type DeskPlan, type DeskSeat } from '@/lib/deskPlans'
import { renderDeskChartJpg, downloadBlob } from '@/lib/deskChartExport'
import elSegundoPods from '@/assets/floor-plans/el-segundo-main-pods.png'
import elSegundoBuilding from '@/assets/floor-plans/el-segundo-main-building.png'
import marinaDelRey from '@/assets/floor-plans/marina-del-rey.png'

// A seating chart: a floor plan with a name box on every seat (Joe,
// 2026-10-21). Saves when a box loses focus or on Enter; Escape puts back
// what was there.
//
// Every change is also logged to desk_assignment_history (migration 061).
// Nothing reads it yet: a "show the chart as of a date" view was built and
// then taken out (Joe, 2026-10-22), keeping the log so it can come back.
//
// Images are imported rather than served from /public so the plans are not
// sitting at a guessable public address. Kept here rather than in
// lib/deskPlans.ts, which the API route also imports.
const IMAGES: Record<string, { plan: StaticImageData; overview?: StaticImageData; overviewAlt?: string }> = {
  'el-segundo-main': { plan: elSegundoPods, overview: elSegundoBuilding, overviewAlt: 'Floor plan of the El Segundo main building' },
  'marina-del-rey':  { plan: marinaDelRey },
}

// Text shrinks to fit its box rather than being cut off, but never below
// this; past it, hover shows the whole name. Widths are in `cqw`, a share of
// the map's own width, so the fit holds at any size the map is drawn.
const MIN_FONT_PX = 8
const CHAR_EM = 0.55

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function DeskMap({ plan, initialNames }: { plan: DeskPlan; initialNames: Record<string, string> }) {
  const [saved, setSaved]   = useState<Record<string, string>>(initialNames)
  const [drafts, setDrafts] = useState<Record<string, string>>(initialNames)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [showOverview, setShowOverview] = useState(false)
  const [exporting, setExporting] = useState(false)

  const images   = IMAGES[plan.id]
  const assigned = plan.seats.filter(s => saved[s.id]).length

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
      if (!res.ok) throw new Error(json.error ?? 'Could not save that seat.')
      setSaved(s => ({ ...s, [seat.id]: name }))
      setDrafts(d => ({ ...d, [seat.id]: name }))
      setStatus(s => ({ ...s, [seat.id]: 'saved' }))
      setTimeout(() => setStatus(s => (s[seat.id] === 'saved' ? { ...s, [seat.id]: 'idle' } : s)), 1500)
    } catch (err) {
      setStatus(s => ({ ...s, [seat.id]: 'error' }))
      toast.error(`${seat.label ?? seat.id}: ${err instanceof Error ? err.message : 'Could not save.'}`)
    }
  }

  // Saved names only: a box still being typed in isn't on the chart yet.
  async function exportJpg() {
    setExporting(true)
    try {
      const now = new Date()
      const blob = await renderDeskChartJpg(plan, images.plan.src, saved, now)
      const day = now.toLocaleDateString('en-CA')   // YYYY-MM-DD
      downloadBlob(blob, `${plan.slug}-seating-chart-${day}.jpg`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export the chart.')
    } finally {
      setExporting(false)
    }
  }

  const yellow = plan.boxTone === 'yellow'

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          Type a name in a box to assign that seat, or clear the box to free it. Changes save as you leave the box.
        </p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500 tabular-nums">{assigned} of {plan.seats.length} assigned</p>
          {plan.exportable && (
            <button
              onClick={exportJpg}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="relative mx-auto"
          style={{ minWidth: plan.minWidth, aspectRatio: `${plan.width} / ${plan.height}`, containerType: 'inline-size' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.plan.src} alt={plan.imageAlt} className="absolute inset-0 w-full h-full select-none" draggable={false} />
          {plan.labels?.map((l, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute whitespace-pre text-center leading-none text-gray-900 pointer-events-none select-none"
              style={{
                left: `${(l.x / plan.width) * 100}%`,
                top:  `${(l.y / plan.height) * 100}%`,
                fontSize: `${(l.size / plan.width) * 100}cqw`,
                fontFamily: 'Arial, Helvetica, sans-serif',
                transform: `translate(-50%, -50%)${l.rotate ? ` rotate(${l.rotate}deg)` : ''}`,
              }}
            >
              {l.text}
            </span>
          ))}
          {plan.seats.map(seat => {
            const st = status[seat.id] ?? 'idle'
            const label = seat.label ?? seat.id
            const value = drafts[seat.id] ?? ''
            // Sized and placed as if horizontal, then turned about its centre,
            // so a sideways box's length runs down the plan. The map keeps the
            // image's aspect ratio, so the length stays the same on screen.
            const w = seat.w ?? plan.boxW
            const h = seat.h ?? plan.boxH
            const hint = seat.placeholder ?? label
            const fitCqw = ((w / plan.width) * 100 * 0.85) / (Math.max((value || hint).length, 1) * CHAR_EM)
            return (
              <input
                key={seat.id}
                type="text"
                value={value}
                maxLength={DESK_NAME_MAX}
                placeholder={hint}
                aria-label={label}
                title={value ? `${value} · ${label}` : label}
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
                  left:   `${((seat.x - w / 2) / plan.width) * 100}%`,
                  top:    `${((seat.y - h / 2) / plan.height) * 100}%`,
                  width:  `${(w / plan.width) * 100}%`,
                  height: `${(h / plan.height) * 100}%`,
                  fontSize: `max(${MIN_FONT_PX}px, min(${plan.fontPx}px, ${fitCqw.toFixed(3)}cqw))`,
                  transform: seat.vertical ? 'rotate(-90deg)' : undefined,
                }}
                className={cn(
                  'rounded px-px text-center text-gray-900 shadow-sm outline-none transition-colors',
                  'placeholder:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:z-10',
                  yellow
                    ? (value ? 'bg-yellow-200 font-medium' : 'bg-yellow-200/70')
                    : (value ? 'bg-white font-medium' : 'bg-white/80'),
                  st === 'saving' ? 'border border-amber-400'
                    : st === 'saved' ? 'border border-emerald-500'
                    : st === 'error' ? 'border-2 border-red-500'
                    : yellow ? 'border border-yellow-500' : 'border border-gray-300',
                )}
              />
            )
          })}
        </div>
      </div>

      {images.overview && (
        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={() => setShowOverview(v => !v)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
            {showOverview ? 'Hide' : 'Show'} the whole building
          </button>
          {showOverview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images.overview.src} alt={images.overviewAlt ?? ''} className="mt-3 w-full h-auto rounded border border-gray-100" />
          )}
        </div>
      )}
    </div>
  )
}
