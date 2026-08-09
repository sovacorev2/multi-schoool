// Supabase/PostgREST caps any query at 1000 rows by default unless you page
// through results with .range(). Any query that can plausibly return more than
// 1000 rows across a whole school (marks, learners) MUST use this instead of a
// plain .select() - otherwise it silently truncates and looks like "no data"
// for whatever didn't fit in the first page.
//
// CRITICAL: the query passed to buildQuery MUST end with a stable .order()
// (e.g. .order('id')). Without one, Postgres does not guarantee the same row
// order across the separate requests each .range() page makes, so rows can
// shift between pages and get returned on TWO pages at once - silent
// duplicates, not silent truncation. This is exactly what was happening to
// school-wide CBC point totals: a learner's marks fetched via an unordered
// multi-page query occasionally included the same mark row twice, inflating
// their total past the mathematically possible maximum. Verified directly
// against production data before this fix (7,672-row query, 1,507 duplicate
// rows, one specific learner's 9 marks became 12 in the fetched array).

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  let all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error || !data) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
