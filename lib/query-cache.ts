/**
 * Lightweight in-memory query cache for Supabase reads.
 *
 * Purpose: drastically reduce egress on the free-tier plan.
 * - Static data (subjects, learners, classes) is cached for 5 minutes.
 * - Marks data is cached for 60 seconds (changes more often).
 * - Cache is per browser tab (module-level Map), so it resets on hard refresh.
 * - Use `invalidate(key)` after a write so the next read is fresh.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

/** Default TTLs in milliseconds */
export const TTL = {
  STATIC: 5 * 60 * 1000,   // subjects, learners, classes, exam_types — rarely change
  MARKS:  60 * 1000,         // marks — can change as teachers enter scores
  SHORT:  30 * 1000,         // sessions, school config
}

/**
 * Read from cache. Returns undefined on miss or expiry.
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.data
}

/**
 * Write to cache with a TTL (ms).
 */
export function cacheSet<T>(key: string, data: T, ttl: number): T {
  cache.set(key, { data, expiresAt: Date.now() + ttl })
  return data
}

/**
 * Invalidate one key (call after writes/upserts).
 */
export function cacheInvalidate(key: string): void {
  cache.delete(key)
}

/**
 * Invalidate all keys that start with a prefix (e.g. after saving marks for a session).
 */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/**
 * Convenience: fetch with cache.
 * If the key is cached and not expired, returns cached value.
 * Otherwise calls `fetcher()`, caches the result, and returns it.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = cacheGet<T>(key)
  if (cached !== undefined) return cached
  const data = await fetcher()
  return cacheSet(key, data, ttl)
}
