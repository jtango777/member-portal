// Days BizHaus is closed. Day passes can't be sold for these, and the
// calendar shows them struck out with the holiday name (Caroline's list,
// 2026-09-17). Weekends are already blocked separately — these are the
// weekday closures.
//
// Extend this each year. A date with no entry is treated as open, so an
// unlisted future year simply behaves as it does today.
export const CLOSURE_DAYS: Record<string, string> = {
  // 2026
  '2026-01-01': 'New Year’s Day',
  '2026-01-19': 'MLK Day',
  '2026-02-16': 'Presidents’ Day',
  '2026-05-25': 'Memorial Day',
  '2026-07-03': 'Day before July 4th',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving',
  '2026-11-27': 'Day after Thanksgiving',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',

  // 2027
  '2027-01-01': 'New Year’s Day',
  '2027-01-18': 'MLK Day',
  '2027-02-15': 'Presidents’ Day',
  '2027-05-31': 'Memorial Day',
  '2027-07-05': 'Day after July 4th',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving',
  '2027-11-26': 'Day after Thanksgiving',
  '2027-12-24': 'Christmas Eve',
  '2027-12-31': 'New Year’s Eve',
}

/** The closure name for a yyyy-MM-dd date, or null when BizHaus is open. */
export function closureName(date: string): string | null {
  return CLOSURE_DAYS[date] ?? null
}
