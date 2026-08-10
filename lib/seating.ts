// Seating options differ by location — everyone also gets a Virtual option
// regardless of location.
export const VIRTUAL_SEATING = 'Virtual'

const SEATING_BY_LOCATION: Record<string, readonly string[]> = {
  'Costa Mesa':     ['Office', 'Dedicated Desk', 'Open Desk'],
  'Marina del Rey': ['Office', 'Dedicated Desk', 'Open Desk'],
  'El Segundo':     ['Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'],
}

// Kept for anywhere that hasn't been switched over to per-location filtering
// yet, or needs the full set (e.g. matching an existing saved value against
// any location's options).
export const SEATING_OPTIONS = [
  ...new Set(Object.values(SEATING_BY_LOCATION).flat()),
  VIRTUAL_SEATING,
] as const

export function getSeatingOptions(locationName: string | null | undefined): string[] {
  const base = locationName ? SEATING_BY_LOCATION[locationName] ?? [] : []
  return [...base, VIRTUAL_SEATING]
}
