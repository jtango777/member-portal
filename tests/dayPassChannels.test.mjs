// The two things in the day pass channel report that can be wrong without
// anyone noticing: which QuickBooks lines count as a day pass, and the
// arithmetic that turns the two sources into a percentage.
//
// QuickBooks itself cannot be called from a dev machine. The credentials in
// .env.local belong to a different Intuit app than production, and using
// them against the production company files marked all three locations
// disconnected once already. So the receipts below are hand-built in the
// shape QuickBooks returns, and the live query stays unverified until this
// runs on the server.
//
// Run with: node --import ./tests/setup.mjs --test tests/

import test from 'node:test'
import assert from 'node:assert/strict'

import { addDayPassLines, buildChannelMonths } from '@/lib/dayPassChannels'
import { recentPacificMonths, nextMonthKey, formatMonthKey } from '@/lib/utils'

const empty = () => ({ revenue: {}, counts: {}, matchedAnything: false })

const DAY_PASS_IDS = new Set(['12'])

function line(itemId, amount, { qty, name } = {}) {
  return {
    Amount: amount,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ...(itemId === null ? {} : { ItemRef: { value: itemId, name: name ?? 'Day Pass' } }),
      ...(qty === undefined ? {} : { Qty: qty }),
    },
  }
}

test('sums only the lines booked against the day pass item', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line('12', 39, { qty: 1 })] },
    // A conference room sale in the same month must not be counted.
    { Id: '2', TxnDate: '2026-10-06', Line: [line('30', 65, { qty: 1, name: 'Conference Room Fee' })] },
    // A mixed receipt contributes only its day pass line.
    { Id: '3', TxnDate: '2026-10-07', Line: [line('12', 39, { qty: 1 }), line('30', 130, { qty: 2 })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())

  assert.equal(totals.revenue['2026-10'], 78)
  assert.equal(totals.counts['2026-10'], 2)
  assert.equal(totals.matchedAnything, true)
})

test('buckets by the receipt date, across months', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-09-30', Line: [line('12', 30, { qty: 1 })] },
    { Id: '2', TxnDate: '2026-10-01', Line: [line('12', 39, { qty: 1 })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())

  assert.deepEqual(totals.revenue, { '2026-09': 30, '2026-10': 39 })
})

test('a voided receipt contributes nothing, because its amounts are zeroed', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line('12', 39, { qty: 1 })] },
    { Id: '2', TxnDate: '2026-10-06', Line: [line('12', 0, { qty: 1 })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())

  assert.equal(totals.revenue['2026-10'], 39)
})

test('matches a sub-item, whose name comes back as Parent:Child', () => {
  // Matching on ItemRef.name alone would miss this one.
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line('12', 39, { qty: 1, name: 'Coworking:Day Pass' })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())

  assert.equal(totals.revenue['2026-10'], 39)
})

test('falls back to the name when a line carries no item id', () => {
  const totals = addDayPassLines([
    {
      Id: '1', TxnDate: '2026-10-05',
      Line: [{
        Amount: 39, DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: { ItemRef: { name: 'Day Pass' }, Qty: 1 },
      }],
    },
  ], DAY_PASS_IDS, 'Day Pass', empty())
  assert.equal(totals.revenue['2026-10'], 39)
})

test('a line with no item reference at all is not a day pass', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line(null, 39, { qty: 1 })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())
  assert.equal(totals.matchedAnything, false)
  assert.deepEqual(totals.revenue, {})
})

test('a desk sale of three days on one line counts as three', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line('12', 90, { qty: 3 })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())

  assert.equal(totals.revenue['2026-10'], 90)
  assert.equal(totals.counts['2026-10'], 3)
})

test('a line with no quantity counts as one', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line('12', 39)] },
  ], DAY_PASS_IDS, 'Day Pass', empty())
  assert.equal(totals.counts['2026-10'], 1)
})

test('skips non-item lines and receipts with no date', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [{ Amount: 5, DetailType: 'DiscountLineDetail' }] },
    { Id: '2', Line: [line('12', 39, { qty: 1 })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())

  assert.deepEqual(totals.revenue, {})
  assert.equal(totals.matchedAnything, false)
})

test('matchedAnything stays false when the item never appears', () => {
  const totals = addDayPassLines([
    { Id: '1', TxnDate: '2026-10-05', Line: [line('30', 65, { qty: 1, name: 'Conference Room Fee' })] },
  ], DAY_PASS_IDS, 'Day Pass', empty())
  assert.equal(totals.matchedAnything, false)
})

// ── The arithmetic ──────────────────────────────────────────────────────────

const label = m => m

test('splits a month into website and desk, and takes the share of total', () => {
  const [row] = buildChannelMonths(
    ['2026-10'], label,
    { revenue: { '2026-10': 1000 }, counts: { '2026-10': 26 }, matchedAnything: true },
    { '2026-10': 390 }, { '2026-10': 10 }
  )

  assert.equal(row.totalRevenue, 1000)
  assert.equal(row.selfServeRevenue, 390)
  assert.equal(row.deskRevenue, 610)
  assert.equal(row.deskCount, 16)
  assert.equal(row.selfServePct, 39)
  assert.equal(row.reconciles, true)
})

test('a month before launch is all desk', () => {
  const [row] = buildChannelMonths(
    ['2026-08'], label,
    { revenue: { '2026-08': 919 }, counts: { '2026-08': 29 }, matchedAnything: true },
    {}, {}
  )
  assert.equal(row.selfServeRevenue, 0)
  assert.equal(row.deskRevenue, 919)
  assert.equal(row.selfServePct, 0)
})

test('an empty month reports no percentage rather than zero', () => {
  const [row] = buildChannelMonths(['2026-05'], label, empty(), {}, {})
  assert.equal(row.totalRevenue, 0)
  assert.equal(row.selfServePct, null)
  assert.equal(row.reconciles, true)
})

test('website above total is flagged, and the desk never goes negative', () => {
  // Happens when a website sale did not reach QuickBooks.
  const [row] = buildChannelMonths(
    ['2026-10'], label,
    { revenue: { '2026-10': 39 }, counts: { '2026-10': 1 }, matchedAnything: true },
    { '2026-10': 78 }, { '2026-10': 2 }
  )
  assert.equal(row.deskRevenue, 0)
  assert.equal(row.deskCount, 0)
  assert.equal(row.reconciles, false)
})

test('floating point alone does not make a month look wrong', () => {
  const [row] = buildChannelMonths(
    ['2026-10'], label,
    { revenue: { '2026-10': 0.1 + 0.2 }, counts: { '2026-10': 1 }, matchedAnything: true },
    { '2026-10': 0.3 }, { '2026-10': 1 }
  )
  assert.equal(row.reconciles, true)
  assert.equal(row.deskRevenue, 0)
})

// ── The month window ────────────────────────────────────────────────────────

test('six months are returned oldest first and in sequence', () => {
  const months = recentPacificMonths(6)
  assert.equal(months.length, 6)
  for (let i = 1; i < months.length; i++) {
    assert.equal(nextMonthKey(months[i - 1]), months[i], `${months[i - 1]} should be followed by ${months[i]}`)
  }
  assert.match(months[5], /^\d{4}-\d{2}$/)
})

test('the month window rolls the year over backwards', () => {
  assert.equal(nextMonthKey('2026-12'), '2027-01')
  assert.equal(nextMonthKey('2026-01'), '2026-02')
})

test('month labels read as a person would write them', () => {
  assert.equal(formatMonthKey('2026-10'), 'October 2026')
  assert.equal(formatMonthKey('2026-01'), 'January 2026')
  assert.equal(formatMonthKey('2026-12'), 'December 2026')
})
