import { qbQuery } from '@/lib/quickbooks'

// Day pass demand by channel.
//
// Day passes are sold two ways and the two ways land in different places.
// The self-serve site writes a row into `day_passes` AND a sales receipt
// into QuickBooks. A staff sale at the front desk is rung up in QuickBooks
// and nowhere else. So this app's own database only ever sees the self-serve
// half, and QuickBooks sees everything.
//
// That is the whole reason this report exists. Comparing the `day_passes`
// table against the pre-launch QuickBooks baseline (about 29 passes and $919
// a month across the three locations, Aug 1 to Sep 25 2026) compares a part
// against a whole, and makes a flat month look like a collapse. Total comes
// from QuickBooks, self-serve comes from the database, desk is the
// difference between them.

/** QuickBooks caps a query page at 1000 rows and defaults to 100. */
const QB_PAGE_SIZE = 1000

/** Stop paging rather than loop forever if QuickBooks keeps returning rows. */
const QB_MAX_PAGES = 20

export type QbLine = {
  Amount?: number
  DetailType?: string
  SalesItemLineDetail?: {
    ItemRef?: { value?: string; name?: string }
    Qty?: number
  }
}

export type QbReceipt = {
  Id?: string
  TxnDate?: string
  Line?: QbLine[]
}

export type MonthTotals = {
  /** Keyed by YYYY-MM. */
  revenue: Record<string, number>
  counts: Record<string, number>
  /** False when no line in any receipt was booked against the day pass item. */
  matchedAnything: boolean
}

export type ChannelIssue = { location: string; message: string }

export type DayPassChannelMonth = {
  month: string
  label: string
  /** From QuickBooks: every channel, all three locations. */
  totalRevenue: number
  totalCount: number
  /** From the `day_passes` table, confirmed only. */
  selfServeRevenue: number
  selfServeCount: number
  /** Total minus self-serve. The front desk, by subtraction. */
  deskRevenue: number
  deskCount: number
  /** Self-serve share of total revenue, or null when total revenue is zero. */
  selfServePct: number | null
  /** False when the subtraction went negative, i.e. the two sides disagree. */
  reconciles: boolean
}

export type DayPassChannelReport = {
  months: DayPassChannelMonth[]
  /**
   * Locations whose QuickBooks numbers are missing or suspect. Any entry
   * here means the totals are understated and the self-serve percentage is
   * overstated, so the UI has to say so rather than print a clean number.
   */
  issues: ChannelIssue[]
  baseline: { label: string; passesPerMonth: number; revenuePerMonth: number }
  launchMonthLabel: string
}

/**
 * Adds every sales-receipt line booked against the day pass product into
 * `into`, bucketed by the Pacific calendar month of the receipt date.
 *
 * Pure, and separate from the fetching above it, because this matching is
 * the part that can be wrong in a way nobody notices: it would just read
 * zero, or quietly count a different product's revenue as day passes.
 */
export function addDayPassLines(
  receipts: QbReceipt[],
  itemIds: Set<string>,
  itemName: string,
  into: MonthTotals
): MonthTotals {
  for (const receipt of receipts) {
    // The receipt date, not the day the pass is for. A sales receipt carries
    // no service date, and this is the date the money came in.
    const month = (receipt.TxnDate ?? '').slice(0, 7)
    if (!month) continue

    for (const line of receipt.Line ?? []) {
      const detail = line.SalesItemLineDetail
      if (!detail) continue
      const ref = detail.ItemRef
      const isDayPass =
        (ref?.value !== undefined && itemIds.has(ref.value)) ||
        // Fallback for the rare line carrying a name and no usable id.
        (ref?.value === undefined && ref?.name === itemName)
      if (!isDayPass) continue

      into.matchedAnything = true
      // A voided receipt keeps its lines but zeroes every amount, so a
      // self-serve pass that was cancelled and refunded drops out of this
      // sum on its own. That matches the self-serve side, which counts
      // confirmed passes only.
      into.revenue[month] = (into.revenue[month] ?? 0) + (line.Amount ?? 0)
      // Qty when it is there, otherwise one line is one pass. A desk sale of
      // three days on one line does say Qty 3, which is closer than counting
      // it once, but it is still an estimate.
      into.counts[month] = (into.counts[month] ?? 0) + (detail.Qty ?? 1)
    }
  }
  return into
}

/**
 * One location's day pass revenue and approximate count per month, read live
 * from that location's QuickBooks company file.
 *
 * Returns the totals it managed to read plus anything the caller has to warn
 * about. It never throws for a QuickBooks problem: one disconnected location
 * should leave the other two readable and say what is missing, not blank the
 * whole report.
 */
export async function readDayPassMonths(
  locationId: string,
  locationName: string,
  itemName: string,
  startDate: string,
  endDate: string
): Promise<{ totals: MonthTotals; issues: ChannelIssue[] }> {
  const totals: MonthTotals = { revenue: {}, counts: {}, matchedAnything: false }
  const issues: ChannelIssue[] = []

  try {
    // Resolve the product/service to an Id first, and match lines on that Id.
    //
    // Two reasons not to compare names on the line. A sub-item comes back as
    // "Parent:Child" in ItemRef.name but is configured here as just the leaf
    // name, and ItemRef.name is not guaranteed to be populated at all.
    // Looking the Id up also gives the one diagnostic that matters: a product
    // name that does not exist in this company file, which is the likeliest
    // way for this report to quietly read zero.
    const safeName = itemName.replace(/'/g, "\\'")
    const itemResult = await qbQuery(locationId, `SELECT Id, Name FROM Item WHERE Name = '${safeName}'`)

    if (!itemResult) {
      issues.push({ location: locationName, message: 'QuickBooks is not connected for this location.' })
      return { totals, issues }
    }

    const items: { Id: string; Name: string }[] = itemResult.QueryResponse?.Item ?? []
    if (items.length === 0) {
      issues.push({
        location: locationName,
        message: `No product or service named "${itemName}" in this location's QuickBooks. Day pass sales here are not being counted.`,
      })
      return { totals, issues }
    }
    const itemIds = new Set(items.map(i => i.Id))

    // TxnDate is both filterable and sortable, which not every field on this
    // entity is. Asking for a field QuickBooks does not allow in a WHERE gets
    // the whole query rejected outright, the way "property 'PrivateNote' is
    // not queryable" killed the first payout lookup (2026-10-13). So this
    // filters on TxnDate alone and matches the item in code.
    // Both Sales Receipts and Invoices. A pass paid for on the spot is a
    // Sales Receipt, which is what the booking site writes, but a pass put on
    // someone's account is an Invoice. Counting receipts alone made August and
    // September come out at about half what a QuickBooks export of the same
    // months showed (Caroline, 2026-10-14).
    for (const entity of ['SalesReceipt', 'Invoice'] as const) {
      for (let page = 0; page < QB_MAX_PAGES; page++) {
        const startPosition = page * QB_PAGE_SIZE + 1
        const result = await qbQuery(
          locationId,
          `SELECT * FROM ${entity} WHERE TxnDate >= '${startDate}' AND TxnDate < '${endDate}'` +
            ` ORDERBY TxnDate STARTPOSITION ${startPosition} MAXRESULTS ${QB_PAGE_SIZE}`
        )

        const docs: QbReceipt[] = result?.QueryResponse?.[entity] ?? []
        if (docs.length === 0) break
        addDayPassLines(docs, itemIds, itemName, totals)
        if (docs.length < QB_PAGE_SIZE) break
      }
    }

    if (!totals.matchedAnything) {
      issues.push({
        location: locationName,
        message: `No "${itemName}" sales found in this location's QuickBooks for these months.`,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[day-pass-channels] QuickBooks failed for ${locationName}:`, message)
    issues.push({
      location: locationName,
      message: message === 'QB_NEEDS_RECONNECT'
        ? 'QuickBooks needs reconnecting for this location, so its sales are missing here.'
        : 'Could not read this location\'s QuickBooks, so its sales are missing here.',
    })
  }

  return { totals, issues }
}

/** Dollars, rounded to the cent. Floating point sums drift otherwise. */
function cents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * One row per month, from the QuickBooks totals and the self-serve totals.
 * Pure, so the arithmetic that the whole report rests on can be checked
 * without QuickBooks in the loop.
 */
export function buildChannelMonths(
  months: string[],
  label: (month: string) => string,
  qb: MonthTotals,
  selfServeRevenue: Record<string, number>,
  selfServeCount: Record<string, number>
): DayPassChannelMonth[] {
  return months.map(month => {
    const total = cents(qb.revenue[month] ?? 0)
    const selfServe = cents(selfServeRevenue[month] ?? 0)
    const totalPasses = Math.round(qb.counts[month] ?? 0)
    const selfServePasses = selfServeCount[month] ?? 0

    // Clamped at zero because the desk number is a subtraction, and a
    // subtraction can go negative when the two sides disagree: a self-serve
    // sale whose QuickBooks receipt failed to write, or a location whose
    // QuickBooks could not be read. A negative front desk would read as
    // nonsense, so show zero and flag that it does not add up.
    return {
      month,
      label: label(month),
      totalRevenue: total,
      totalCount: totalPasses,
      selfServeRevenue: selfServe,
      selfServeCount: selfServePasses,
      deskRevenue: cents(Math.max(0, total - selfServe)),
      deskCount: Math.max(0, totalPasses - selfServePasses),
      selfServePct: total > 0 ? Math.round((selfServe / total) * 100) : null,
      // Half a cent of slack, so floating point alone never raises the flag.
      reconciles: selfServe <= total + 0.005 && selfServePasses <= totalPasses,
    }
  })
}
