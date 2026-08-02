// Supabase/PostgREST caps any query at 1000 rows by default unless you page
// through results with .range(). Any query that can plausibly return more than
// 1000 rows across a whole school (marks, learners) MUST use this instead of a
// plain .select() — otherwise it silently truncates and looks like "no data"
// for whatever didn't fit in the first page.
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
