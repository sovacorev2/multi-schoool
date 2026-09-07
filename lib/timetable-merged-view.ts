// Shared "resolve a CBC level's real clock-time grid, then merge several of
// them into one axis" logic used by both the admin portal's Timetable page
// (View & Edit -> By Teacher) and the teacher-facing MyTimetablePanel. Both
// need the same thing: most teachers only teach within one CBC level, so
// their schedule renders exactly like it always has (plain period columns).
// A teacher whose classes span more than one level (a specialist covering
// Pre-School and JSS, a head teacher covering lessons everywhere) needs a
// merged view, since "period 3" isn't the same clock time in both levels -
// so that view is built from the union of real time-blocks in use instead.

import {
  computePeriodsPerDay,
  computePeriodTimes,
  computePeriodStartEndMinutes,
  minutesToTimeString,
  timeStringToMinutes,
  type TimetablePeriodStartEnd,
  type TimetablePeriodTime,
} from './timetable-generator'

export interface CategorySettingsRow {
  school_start_time: string
  school_end_time: string
  period_length_minutes: number
  days_per_week: number
  avoid_consecutive_same_subject: boolean
  spread_evenly: boolean
}

export interface CategoryBreakRow {
  name: string
  after_period_number: number
  duration_minutes: number
}

export interface ResolvedCategoryGrid {
  category: string
  daysPerWeek: number
  periodsPerDay: number
  periodStartEndMinutes: TimetablePeriodStartEnd[]
  periodTimes: TimetablePeriodTime[]
  breaks: CategoryBreakRow[]
  /** The declared end of the school day - not necessarily when the last
   * period actually ends (see computeBlockedSlots below for why that gap
   * matters). */
  schoolEndTime: string
}

export function resolveCategoryGrid(category: string, settings: CategorySettingsRow, breaks: CategoryBreakRow[]): ResolvedCategoryGrid {
  const breaksForCompute = breaks.map((b) => ({ afterPeriodNumber: b.after_period_number, durationMinutes: b.duration_minutes }))
  const periodsPerDay = computePeriodsPerDay(
    settings.school_start_time,
    settings.school_end_time,
    settings.period_length_minutes,
    breaksForCompute
  )
  return {
    category,
    daysPerWeek: settings.days_per_week,
    periodsPerDay,
    periodStartEndMinutes: computePeriodStartEndMinutes(settings.school_start_time, settings.period_length_minutes, periodsPerDay, breaksForCompute),
    periodTimes: computePeriodTimes(settings.school_start_time, settings.period_length_minutes, periodsPerDay, breaksForCompute),
    breaks,
    schoolEndTime: settings.school_end_time,
  }
}

export interface BlockedWindowInput {
  day_of_week: number | null
  start_time: string
  end_time: string
  label: string
}

export interface BlockedSlot {
  day: number
  period: number
  label: string
}

/** Maps each applicable blocked window to the (day, period) pairs it covers,
 * by real clock-time overlap with the class's own resolved period grid.
 * day_of_week null applies to every day in the week.
 *
 * A fixed period length rarely divides the declared school day evenly -
 * computePeriodsPerDay floors the division, so there's commonly a handful
 * of leftover minutes at the very end of the day (sometimes 30-40+) that no
 * period ever covers. A blocked window placed in exactly that trailing gap
 * - "one more thing before end of day" is exactly what a closing
 * discussion, assembly, or games slot usually is - would otherwise overlap
 * no period at all and silently vanish: not blocked at generation time, not
 * shown on the grid or printout, with no error to explain why. So a window
 * that overlaps nothing but starts at or after the grid's last period and
 * before the declared school end time still attaches to that last period
 * instead of being dropped. */
export function computeBlockedSlots(
  windows: BlockedWindowInput[],
  daysPerWeek: number,
  periodStartEndMinutes: TimetablePeriodStartEnd[],
  schoolEndTime: string
): BlockedSlot[] {
  const slots: BlockedSlot[] = []
  const schoolEndMinutes = timeStringToMinutes(schoolEndTime)
  const lastPeriod = periodStartEndMinutes[periodStartEndMinutes.length - 1]
  for (const w of windows) {
    const wStart = timeStringToMinutes(w.start_time)
    const wEnd = timeStringToMinutes(w.end_time)
    const days = w.day_of_week != null ? [w.day_of_week] : Array.from({ length: daysPerWeek }, (_, i) => i + 1)
    for (const day of days) {
      const overlapping = periodStartEndMinutes.filter((p) => p.startMinutes < wEnd && p.endMinutes > wStart)
      if (overlapping.length > 0) {
        for (const p of overlapping) slots.push({ day, period: p.period, label: w.label })
      } else if (lastPeriod && wStart >= lastPeriod.endMinutes && wStart < schoolEndMinutes) {
        slots.push({ day, period: lastPeriod.period, label: w.label })
      }
    }
  }
  return slots
}

export interface MergedColumn {
  key: string
  label: string
  subLabel: string
  startMinutes: number
}

/** Union of every distinct real time-block used across the given category
 * grids, sorted by start time. Two levels that happen to share an identical
 * period (same start and end minute) collapse into one column. */
export function buildMergedColumns(grids: ResolvedCategoryGrid[]): MergedColumn[] {
  const seen = new Map<string, MergedColumn>()
  for (const grid of grids) {
    for (const p of grid.periodStartEndMinutes) {
      const key = `${p.startMinutes}-${p.endMinutes}`
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          label: minutesToTimeString(p.startMinutes),
          subLabel: minutesToTimeString(p.endMinutes),
          startMinutes: p.startMinutes,
        })
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.startMinutes - b.startMinutes)
}

/** Which merged-axis column a given (category, period number) entry lands on. */
export function mergedColumnKeyFor(grid: ResolvedCategoryGrid, periodNumber: number): string | null {
  const p = grid.periodStartEndMinutes.find((x) => x.period === periodNumber)
  if (!p) return null
  return `${p.startMinutes}-${p.endMinutes}`
}

export interface TeacherForInitials {
  id: string
  first_name: string
  last_name: string
}

/** Short, stable, collision-resistant initials for a whole-school block
 * timetable, where full teacher names don't fit in every cell. A collision
 * (two teachers sharing initials) gets a numeric suffix (JD, JD2, JD3...)
 * rather than silently colliding in the legend. */
export function computeTeacherInitials(teachers: TeacherForInitials[]): Map<string, string> {
  const counts = new Map<string, number>()
  const result = new Map<string, string>()
  for (const t of teachers) {
    const base = `${(t.first_name.trim()[0] || '').toUpperCase()}${(t.last_name.trim()[0] || '').toUpperCase()}` || '??'
    const seen = counts.get(base) || 0
    result.set(t.id, seen === 0 ? base : `${base}${seen + 1}`)
    counts.set(base, seen + 1)
  }
  return result
}
