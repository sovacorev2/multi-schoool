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
}

export function resolveCategoryGrid(category: string, settings: CategorySettingsRow, breaks: CategoryBreakRow[]): ResolvedCategoryGrid {
  const breaksForCompute = breaks.map((b) => ({ afterPeriodNumber: b.after_period_number, durationMinutes: b.duration_minutes }))
  const periodsPerDay = computePeriodsPerDay(
    settings.school_start_time,
    settings.school_end_time,
    settings.period_length_minutes,
    breaks.map((b) => ({ durationMinutes: b.duration_minutes }))
  )
  return {
    category,
    daysPerWeek: settings.days_per_week,
    periodsPerDay,
    periodStartEndMinutes: computePeriodStartEndMinutes(settings.school_start_time, settings.period_length_minutes, periodsPerDay, breaksForCompute),
    periodTimes: computePeriodTimes(settings.school_start_time, settings.period_length_minutes, periodsPerDay, breaksForCompute),
    breaks,
  }
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
