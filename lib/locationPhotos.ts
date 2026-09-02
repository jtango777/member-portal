// Shared open-desk-space photos, keyed by location id — same 3 real
// locations, same photos used on the day-pass reservation flow
// (app/day-pass/page.tsx's LOCATIONS) and now the account bookings list.
// Not deduplicated into one shared LOCATIONS constant to avoid touching
// that already-tested flow while adding this — just the photo paths.
export const LOCATION_PHOTOS: Record<string, { src: string; position?: string }> = {
  '11111111-1111-1111-1111-111111111101': { src: '/rooms/es-open-space.jpg' },
  '11111111-1111-1111-1111-111111111102': { src: '/rooms/mdr-open-space.jpg', position: 'center 70%' },
  '11111111-1111-1111-1111-111111111103': { src: '/rooms/cm-open-space.jpg' },
}
