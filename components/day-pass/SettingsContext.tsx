'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { DAY_PASS_PRICE_CENTS } from '@/lib/dayPass'

// The price and the closure-day list are editable by staff now, so the day
// pass page reads them at runtime instead of holding constants (Caroline,
// 2026-09-25). They're small, change rarely, and every booking route
// re-checks both server-side, so a plain fetch on mount is enough.
//
// The fallback price is the old constant, so the page shows a sensible
// number for the moment before the fetch lands rather than "$0".
export type DayPassSettings = {
  priceCents: number
  priceDollars: number
  closures: Record<string, string>
}

const FALLBACK: DayPassSettings = {
  priceCents: DAY_PASS_PRICE_CENTS,
  priceDollars: DAY_PASS_PRICE_CENTS / 100,
  closures: {},
}

const SettingsContext = createContext<DayPassSettings>(FALLBACK)

export function useDayPassSettings() {
  return useContext(SettingsContext)
}

export function DayPassSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DayPassSettings>(FALLBACK)

  useEffect(() => {
    let cancelled = false
    fetch('/api/day-pass/settings')
      .then(res => res.json())
      .then(data => {
        if (cancelled || !Number.isFinite(data?.priceCents)) return
        setSettings({
          priceCents: data.priceCents,
          priceDollars: data.priceCents / 100,
          closures: data.closures ?? {},
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}
