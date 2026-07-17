// Members/photos added before this date don't count as "new" — prevents
// backdated seed data from showing up as new faces the moment this
// feature ships. Set to the date this feature was released.
export const NEW_FACES_LAUNCH = new Date('2026-07-17T00:00:00Z')

export function newFacesCutoff(): Date {
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  return twoMonthsAgo > NEW_FACES_LAUNCH ? twoMonthsAgo : NEW_FACES_LAUNCH
}
