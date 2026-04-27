// Fallback data for when database connectivity fails
export const FALLBACK_DATA = {
  exam_types: [
    { id: 'exam-1', name: 'Opener', description: 'Opening exam at the start of term', display_order: 1, created_at: new Date().toISOString() },
    { id: 'exam-2', name: 'Midterm', description: 'Mid-term examination', display_order: 2, created_at: new Date().toISOString() },
    { id: 'exam-3', name: 'Endterm', description: 'End of term examination', display_order: 3, created_at: new Date().toISOString() },
  ],
  classes: [
    { id: 'cls-1', name: 'PP1', code: 'PP1', display_order: 1, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-2', name: 'PP2', code: 'PP2', display_order: 2, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-3', name: 'Grade 1', code: 'GRD1', display_order: 3, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-4', name: 'Grade 2', code: 'GRD2', display_order: 4, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-5', name: 'Grade 3', code: 'GRD3', display_order: 5, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-6', name: 'Grade 4', code: 'GRD4', display_order: 6, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-7', name: 'Grade 5', code: 'GRD5', display_order: 7, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-8', name: 'Grade 6', code: 'GRD6', display_order: 8, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-9', name: 'Grade 7', code: 'GRD7', display_order: 9, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-10', name: 'Grade 8', code: 'GRD8', display_order: 10, teacher_name: null, password: null, created_at: new Date().toISOString() },
    { id: 'cls-11', name: 'Grade 9', code: 'GRD9', display_order: 11, teacher_name: null, password: null, created_at: new Date().toISOString() },
  ],
  admin_settings: [
    { id: 'setting-1', key: 'admin_password', value: 'admin123', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
}

/**
 * Check if an error is a network/connectivity error
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  const details = error.details?.toLowerCase() || ''
  
  return (
    message.includes('fetch failed') ||
    message.includes('err_name_not_resolved') ||
    message.includes('network') ||
    message.includes('timeout') ||
    details.includes('fetch failed') ||
    details.includes('network')
  )
}

/**
 * Get fallback data, preferring localStorage cache if available
 */
export function getFallbackData<T>(key: keyof typeof FALLBACK_DATA): T[] {
  // Try to get from localStorage
  try {
    const cached = localStorage.getItem(`fallback_${key}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (e) {
    // localStorage access failed, use hardcoded fallback
  }

  // Return hardcoded fallback
  return (FALLBACK_DATA[key] || []) as T[]
}

/**
 * Cache fallback data to localStorage
 */
export function cacheFallbackData<T>(key: keyof typeof FALLBACK_DATA, data: T[]): void {
  try {
    localStorage.setItem(`fallback_${key}`, JSON.stringify(data))
  } catch (e) {
    // localStorage write failed, ignore
  }
}
