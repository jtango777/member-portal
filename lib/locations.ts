// Where the three BizHaus day pass locations actually are.
//
// The `locations` table only holds id, name, slug and the two QuickBooks
// item columns, so the street address, phone number and door code have
// never lived in the database. They used to live in two hand-kept copies
// that mirrored each other, one in app/day-pass/page.tsx and one in
// lib/email.ts, each with a comment pointing at the other. Redesigning My
// Bookings needed the same details a third time (Caroline, 2026-09-30),
// which is exactly how that kind of copy drifts, so this is the one
// definition all three read from.
//
// Plain data and pure functions only, no server imports, because the day
// pass reservation flow that pulls this in is a client component.

export type DayPassLocation = {
  id: string
  name: string
  phone: string
  /** Full postal address. What maps, directions and calendar files want. */
  address: string
  /**
   * Shorter form, no state or zip. The confirmation emails print this
   * inline after the location name, so it stays a separate field rather
   * than being derived, to keep those letters reading the way they do now.
   */
  shortAddress: string
  photo: string
  photoPosition?: string
  /**
   * Marina del Rey is a satellite space with nobody at the desk until the
   * afternoon, so day pass guests let themselves in. The code is
   * deliberately static (Caroline): the same one opens the building and
   * Suite C215. The other two locations have a staffed front desk and no
   * code at all, which is why this is optional.
   */
  doorCode?: string
  /** Marina gets its own confirmation email template, see lib/email.ts. */
  isMarina?: boolean
}

// The ids match the real `locations` rows so the API routes' foreign key
// checks pass. Photos reuse the same open-space shots /book uses for its
// location banners; Caroline confirmed all three are accurate as of
// 2026-08-31 (Costa Mesa's was replaced that day, the old one showed an
// unrelated outdoor patio rather than the desk area).
export const DAY_PASS_LOCATIONS: readonly DayPassLocation[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'El Segundo',
    phone: '(310) 870-1730',
    address: '1730 E Holly Ave, El Segundo, CA 90245',
    shortAddress: '1730 E Holly Ave, El Segundo',
    photo: '/rooms/es-open-space.jpg',
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Marina del Rey',
    phone: '(310) 596-1990',
    address: '4223 Glencoe Ave Ste C215, Marina Del Rey, CA 90292',
    shortAddress: '4223 Glencoe Ave Ste C215, Marina del Rey',
    photo: '/rooms/mdr-open-space.jpg',
    photoPosition: 'center 70%',
    doorCode: '5075',
    isMarina: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Costa Mesa',
    phone: '(949) 800-8660',
    address: '2942 Century Pl, Costa Mesa, CA 92626',
    shortAddress: '2942 Century Pl, Costa Mesa',
    photo: '/rooms/cm-open-space.jpg',
  },
]

// Keyed by the exact `locations.name` value, which is what the emails and
// the bookings list have in hand rather than an id.
export const DAY_PASS_LOCATIONS_BY_NAME: Record<string, DayPassLocation> =
  Object.fromEntries(DAY_PASS_LOCATIONS.map(loc => [loc.name, loc]))

/** Google Maps turn-by-turn link, the one behind every "Get directions". */
export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

/** Embeddable map of an address, for the small iframe previews. */
export function mapEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}
