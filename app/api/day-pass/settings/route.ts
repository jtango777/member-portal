import { NextResponse } from 'next/server'
import { getDayPassPriceCents, getClosureMap } from '@/lib/settings'

// What the day pass page needs to render: the current price and the days
// we're closed. Both are editable by staff at /dashboard/admin/day-passes,
// so the page can't hold them as constants any more (Caroline, 2026-09-25).
//
// Public on purpose — the price is printed on the page and the closed days
// are greyed out in the picker. Every booking route re-reads both before
// taking any money, so this is for display only.
export async function GET() {
  const [priceCents, closures] = await Promise.all([
    getDayPassPriceCents(),
    getClosureMap('day_pass'),
  ])
  return NextResponse.json({ priceCents, closures })
}
