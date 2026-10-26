import type { DeskPlan } from '@/lib/deskPlans'

// Draws a seating chart into a JPG: the plan image, its labels, and every
// assigned name in its box, under a title and date (Joe, 2026-10-22).
// Browser only. Mirrors what DeskMap shows, minus the hints in empty boxes.

const SCALE = 3          // image pixels -> output pixels; 796px plan -> ~2400px
const HEADER = 34        // title strip, in image pixels
const FONT = 'Arial, Helvetica, sans-serif'

const TONES = {
  yellow: { fill: '#fef08a', stroke: '#eab308' },   // yellow-200 / yellow-500
  white:  { fill: '#ffffff', stroke: '#d1d5db' },   // white / gray-300
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the floor plan image.'))
    img.src = src
  })
}

export async function renderDeskChartJpg(
  plan: DeskPlan,
  imageSrc: string,
  names: Record<string, string>,
  when: Date,
): Promise<Blob> {
  const img = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width  = plan.width * SCALE
  canvas.height = (plan.height + HEADER) * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot draw the chart.')

  // Work in image pixels from here on; the header sits above the plan.
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, plan.width, plan.height + HEADER)

  ctx.fillStyle = '#111827'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `bold 14px ${FONT}`
  ctx.fillText(plan.title, 12, HEADER / 2)
  ctx.textAlign = 'right'
  ctx.font = `11px ${FONT}`
  ctx.fillStyle = '#6b7280'
  ctx.fillText(when.toLocaleDateString('en-US', { dateStyle: 'long' }), plan.width - 12, HEADER / 2)

  ctx.translate(0, HEADER)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, plan.width, plan.height)

  // Labels: centred, optionally turned, possibly two lines.
  ctx.fillStyle = '#111827'
  ctx.textAlign = 'center'
  for (const l of plan.labels ?? []) {
    ctx.save()
    ctx.translate(l.x, l.y)
    if (l.rotate) ctx.rotate((l.rotate * Math.PI) / 180)
    ctx.font = `${l.size}px ${FONT}`
    const lines = l.text.split('\n')
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * l.size))
    ctx.restore()
  }

  // Seat boxes, with the name shrunk to fit like on screen.
  const tone = TONES[plan.boxTone ?? 'white']
  for (const seat of plan.seats) {
    const name = names[seat.id]?.trim()
    const w = seat.w ?? plan.boxW
    const h = seat.h ?? plan.boxH
    ctx.save()
    ctx.translate(seat.x, seat.y)
    if (seat.vertical) ctx.rotate(-Math.PI / 2)
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 2)
    else ctx.rect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = name ? tone.fill : 'rgba(255,255,255,0.6)'
    ctx.fill()
    ctx.lineWidth = 0.6
    ctx.strokeStyle = tone.stroke
    ctx.stroke()
    if (name) {
      let size = Math.min(h * 0.62, plan.fontPx)
      ctx.font = `bold ${size}px ${FONT}`
      const room = w - 3
      const width = ctx.measureText(name).width
      if (width > room) { size *= room / width; ctx.font = `bold ${size}px ${FONT}` }
      ctx.fillStyle = '#111827'
      ctx.fillText(name, 0, 0.5)
    }
    ctx.restore()
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/jpeg', 0.92))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
