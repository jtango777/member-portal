/**
 * Every row a query matches, not the first thousand of them.
 *
 * PostgREST caps a response at 1000 rows and says nothing about it: no
 * error, no flag, just a short list. Anything that counts, sums or scans
 * a whole table is quietly wrong from the thousandth row on, and only
 * gets more wrong as the table grows.
 *
 * Found on 2026-11-20, when the reservations table passed 1278 rows and
 * admin/members/details was reading 1000 of them to work out which
 * company a member belongs to. The same cap also made a count of
 * conference room bookings read as exactly 1000 (Caroline, 2026-11-20).
 *
 * Use this wherever a select has no narrow filter on it. A query already
 * scoped to one month or one room cannot reach the cap and does not need
 * it.
 *
 *   const { data, error } = await selectAll((from, to) =>
 *     admin.from('reservations').select('id, company_id').range(from, to))
 *
 * The callback is handed a range and must apply it; everything else about
 * the query is yours.
 */

const PAGE = 1000

type Page<T> = { data: T[] | null; error: { message: string } | null }

export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) return { data: rows, error: error.message }
    const got = data ?? []
    rows.push(...got)
    // A short page is the last page. An exactly-full one might not be.
    if (got.length < PAGE) return { data: rows, error: null }
  }
}
