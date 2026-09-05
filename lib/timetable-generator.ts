// Pure, DB-free timetable scheduling engine. Runs client-side, same as this
// app's other heavy computation (school-analysis-report.ts, marklist
// rankings) - no server compute budget concerns, no new API route needed.
//
// Approach: sequential greedy placement with constraint relaxation, most-
// constrained-subject-first, tracking teacher occupancy globally across every
// class so two classes can never be assigned the same teacher at the same
// slot. Not globally optimal, but always valid (no double-bookings) and any
// period that genuinely can't be placed is reported, never silently dropped.
//
// Settings (school hours, period length, breaks, toggles) are per CBC level
// (Pre-School/Lower/Upper Primary/Junior Secondary), not one shared school-
// wide structure - so every class carries its OWN resolved day structure.
// That means "period 3" in one class is not necessarily the same clock time
// as "period 3" in another. Teacher-conflict checking is therefore done by
// comparing real clock-time intervals, not period numbers, so a specialist
// teacher (CRE, Music, PE, a head teacher covering a lesson) who teaches
// across levels with different structures still can't be double-booked.

export interface TimetableSubjectInput {
  subjectId: string
  subjectName: string
  periodsPerWeek: number
  teacherId: string | null
  teacherName: string | null
}

export interface TimetablePeriodStartEnd {
  period: number
  startMinutes: number
  endMinutes: number
}

export interface TimetableClassInput {
  classId: string
  className: string
  daysPerWeek: number
  periodsPerDay: number
  /** This class's own period->clock-time mapping (minutes since midnight), from its level's settings. */
  periodStartEndMinutes: TimetablePeriodStartEnd[]
  breakAfterPeriods: number[]
  /** The period number the longest break of the day falls after (i.e. lunch), or null if there's no break to treat as lunch. Math is hard-excluded from any period after this one. */
  lunchAfterPeriod: number | null
  /** (day, period) pairs this class can never be scheduled into - e.g. Monday
   * assembly, Friday church time. Unlike breakAfterPeriods (which apply the
   * same way every day and are baked into periodStartEndMinutes), these are
   * day-specific, computed by the caller from timetable_blocked_windows
   * overlapping this class's own period grid. */
  blockedSlots: { day: number; period: number }[]
  /** Double lessons are a JSS convention, not universal - off by default for other levels, and always overridable per level in Settings. */
  enableDoubleLessons: boolean
  avoidConsecutiveSameSubject: boolean
  spreadEvenly: boolean
  subjects: TimetableSubjectInput[]
}

export interface TimetableEntry {
  classId: string
  subjectId: string
  teacherId: string | null
  dayOfWeek: number
  periodNumber: number
}

export interface TimetableConflict {
  classId: string
  className: string
  subjectId: string
  subjectName: string
  requested: number
  placed: number
  reason: string
}

export interface TimetableWarning {
  classId: string
  className: string
  subjectId: string
  subjectName: string
  message: string
}

export interface TimetableGenerationResult {
  entries: TimetableEntry[]
  conflicts: TimetableConflict[]
  warnings: TimetableWarning[]
}

export function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** Teaching periods that fit in a day, after subtracting break time. Only one
 * break can physically happen after a given period, so entries sharing the
 * same afterPeriodNumber are deduped (last one wins) before summing - the
 * same rule computePeriodStartEndMinutes below already applies via its own
 * Map. Without this, a school that ends up with duplicate break rows for the
 * same slot (e.g. a re-saved settings form) would have its break minutes
 * double- or triple-counted here while the actual period grid only ever
 * blocks out one of them, silently shrinking periodsPerDay far below what's
 * actually being blocked on the timetable itself. */
export function computePeriodsPerDay(
  schoolStartTime: string,
  schoolEndTime: string,
  periodLengthMinutes: number,
  breaks: { afterPeriodNumber: number; durationMinutes: number }[]
): number {
  const totalMinutes = timeStringToMinutes(schoolEndTime) - timeStringToMinutes(schoolStartTime)
  const dedupedBreaks = new Map(breaks.map((b) => [b.afterPeriodNumber, b.durationMinutes]))
  const totalBreakMinutes = [...dedupedBreaks.values()].reduce((sum, d) => sum + d, 0)
  const teachingMinutes = Math.max(0, totalMinutes - totalBreakMinutes)
  return periodLengthMinutes > 0 ? Math.floor(teachingMinutes / periodLengthMinutes) : 0
}

export interface TimetablePeriodTime {
  period: number
  startTime: string
  endTime: string
}

/** Clock start/end time (as "HH:MM" strings, for display) for every teaching period, accounting for where breaks fall. */
export function computePeriodTimes(
  schoolStartTime: string,
  periodLengthMinutes: number,
  periodsPerDay: number,
  breaks: { afterPeriodNumber: number; durationMinutes: number }[]
): TimetablePeriodTime[] {
  return computePeriodStartEndMinutes(schoolStartTime, periodLengthMinutes, periodsPerDay, breaks).map((p) => ({
    period: p.period,
    startTime: minutesToTimeString(p.startMinutes),
    endTime: minutesToTimeString(p.endMinutes),
  }))
}

/** Same as computePeriodTimes but in raw minutes-since-midnight, for interval-overlap conflict checking. */
export function computePeriodStartEndMinutes(
  schoolStartTime: string,
  periodLengthMinutes: number,
  periodsPerDay: number,
  breaks: { afterPeriodNumber: number; durationMinutes: number }[]
): TimetablePeriodStartEnd[] {
  const breakAfterPeriod = new Map(breaks.map((b) => [b.afterPeriodNumber, b.durationMinutes]))
  let cursor = timeStringToMinutes(schoolStartTime)
  const result: TimetablePeriodStartEnd[] = []
  for (let period = 1; period <= periodsPerDay; period++) {
    const start = cursor
    const end = start + periodLengthMinutes
    result.push({ period, startMinutes: start, endMinutes: end })
    cursor = end
    const breakMinutes = breakAfterPeriod.get(period)
    if (breakMinutes) cursor += breakMinutes
  }
  return result
}

const slotKey = (day: number, period: number) => `${day}|${period}`
const teacherDayKey = (teacherId: string, day: number) => `${teacherId}|${day}`

export type SubjectTimingPreference = 'morning' | 'afternoon' | 'neutral'

// Grounded in two things: (1) chronobiology research showing sustained-focus
// subjects (numeracy, language) are best served by learners' peak-alertness
// morning hours, most pronounced for younger children; (2) Kenya's KICD
// timetabling guidance, which calls for "balance in the distribution of
// subjects for morning and afternoon hours" rather than a rigid rule - so
// this is a soft scoring preference, not a hard constraint, and can be
// overridden by the actual placement constraints (teacher availability etc).
const MORNING_KEYWORDS = [
  'math', 'hisabati', 'english', 'kiswahili', 'kusoma', 'reading', 'language',
  'science', 'sayansi', 'literacy',
]
const AFTERNOON_KEYWORDS = [
  'cre', 'ire', 'hre', 'religio', 'creative art', 'cas', 'physical', ' pe ', 'sport',
  'music', 'muziki', 'agricultur', 'kilimo', 'environmental', 'mazingira',
  'pastoral', 'life skill',
]

export function classifySubjectTiming(subjectName: string): SubjectTimingPreference {
  const name = ` ${subjectName.trim().toLowerCase()} `
  if (MORNING_KEYWORDS.some((k) => name.includes(k))) return 'morning'
  if (AFTERNOON_KEYWORDS.some((k) => name.includes(k))) return 'afternoon'
  return 'neutral'
}

function isMathSubject(subjectName: string): boolean {
  const name = ` ${subjectName.trim().toLowerCase()} `
  return name.includes('math') || name.includes('hisabati')
}

/** English and Kiswahili must never land in adjacent periods (hard rule, not
 * a soft preference) - back-to-back language lessons is exactly the pattern
 * schools want to avoid. Null for every other subject, so the adjacency
 * check below only ever fires between this specific pair. */
type LanguagePair = 'english' | 'kiswahili'
function languagePairId(subjectName: string): LanguagePair | null {
  const name = ` ${subjectName.trim().toLowerCase()} `
  if (name.includes('english')) return 'english'
  if (name.includes('kiswahili')) return 'kiswahili'
  return null
}

/**
 * How many double lessons (2 consecutive periods, same day, same teacher) a
 * subject should get this week, capped by how many periods it actually has
 * to spend. Matches Kenya's KICD guidance, which specifically calls out
 * double-period slots as a deliberate, recognized exception for STEM
 * subjects - Mathematics gets two, every other multi-period subject gets one.
 */
function targetDoubleLessonCount(subj: TimetableSubjectInput): number {
  if (subj.periodsPerWeek < 2) return 0
  const target = isMathSubject(subj.subjectName) ? 2 : 1
  return Math.min(target, Math.floor(subj.periodsPerWeek / 2))
}

/** Global, cross-class, cross-category teacher booking tracker, keyed by real clock time. */
class TeacherBookings {
  private byTeacherDay = new Map<string, { start: number; end: number }[]>()
  private countByTeacherDay = new Map<string, number>()

  isFree(teacherId: string, day: number, startMinutes: number, endMinutes: number, maxPerDay: number | null): boolean {
    const key = teacherDayKey(teacherId, day)
    const bookings = this.byTeacherDay.get(key)
    if (bookings) {
      for (const b of bookings) {
        if (startMinutes < b.end && endMinutes > b.start) return false // real-time overlap
      }
    }
    if (maxPerDay != null) {
      const count = this.countByTeacherDay.get(key) || 0
      if (count >= maxPerDay) return false
    }
    return true
  }

  book(teacherId: string, day: number, startMinutes: number, endMinutes: number): void {
    const key = teacherDayKey(teacherId, day)
    if (!this.byTeacherDay.has(key)) this.byTeacherDay.set(key, [])
    this.byTeacherDay.get(key)!.push({ start: startMinutes, end: endMinutes })
    this.countByTeacherDay.set(key, (this.countByTeacherDay.get(key) || 0) + 1)
  }
}

function findBestSlot(
  subj: TimetableSubjectInput,
  cls: TimetableClassInput,
  periodTimeByNumber: Map<number, TimetablePeriodStartEnd>,
  classGrid: Map<string, string>,
  subjectDayCount: Map<string, number>,
  subjectAtPeriodAcrossDays: Map<string, number>,
  teacherBookings: TeacherBookings,
  teacherMaxPerDay: Map<string, number | null>,
  subjectById: Map<string, TimetableSubjectInput>
): { day: number; period: number } | null {
  const { daysPerWeek, periodsPerDay, avoidConsecutiveSameSubject: avoidConsecutive, spreadEvenly, lunchAfterPeriod } = cls
  const blockedSlotSet = new Set(cls.blockedSlots.map((b) => slotKey(b.day, b.period)))

  const openSlots: { day: number; period: number }[] = []
  for (let day = 1; day <= daysPerWeek; day++) {
    for (let period = 1; period <= periodsPerDay; period++) {
      if (!classGrid.has(slotKey(day, period)) && !blockedSlotSet.has(slotKey(day, period))) openSlots.push({ day, period })
    }
  }

  const isTeacherFree = (day: number, period: number) => {
    if (!subj.teacherId) return true
    const t = periodTimeByNumber.get(period)
    if (!t) return false
    return teacherBookings.isFree(subj.teacherId, day, t.startMinutes, t.endMinutes, teacherMaxPerDay.get(subj.teacherId) ?? null)
  }

  // Hard, never-relaxed rules - unlike the consecutive-same-subject check
  // below, these don't get a second, looser pass if placement gets tight.
  const isMath = isMathSubject(subj.subjectName)
  const violatesLunchRule = (period: number) => isMath && lunchAfterPeriod != null && period > lunchAfterPeriod

  const myLanguage = languagePairId(subj.subjectName)
  const violatesLanguageAdjacency = (day: number, period: number) => {
    if (!myLanguage) return false
    const otherLanguage: LanguagePair = myLanguage === 'english' ? 'kiswahili' : 'english'
    for (const neighborId of [classGrid.get(slotKey(day, period - 1)), classGrid.get(slotKey(day, period + 1))]) {
      const neighbor = neighborId ? subjectById.get(neighborId) : undefined
      if (neighbor && languagePairId(neighbor.subjectName) === otherLanguage) return true
    }
    return false
  }

  const hardFilteredSlots = openSlots.filter(
    ({ day, period }) => isTeacherFree(day, period) && !violatesLunchRule(period) && !violatesLanguageAdjacency(day, period)
  )

  const isConsecutiveViolation = (day: number, period: number) => {
    const before = classGrid.get(slotKey(day, period - 1))
    const after = classGrid.get(slotKey(day, period + 1))
    return before === subj.subjectId || after === subj.subjectId
  }

  const timing = classifySubjectTiming(subj.subjectName)
  const midpoint = periodsPerDay / 2

  // Lower is better. Combines every soft preference into one score so a
  // single ranking pass balances them, instead of one preference always
  // trumping the others via a fixed sort order.
  const scoreCandidate = (day: number, period: number) => {
    let cost = 0

    if (spreadEvenly) {
      // Discourage cramming a subject's periods onto the same day.
      cost += (subjectDayCount.get(`${subj.subjectId}|${day}`) || 0) * 10
    }

    if (timing === 'morning') {
      cost += Math.max(0, period - midpoint) * 3
    } else if (timing === 'afternoon') {
      cost += Math.max(0, midpoint - period) * 3
    }

    // Discourage a rigid "this subject is always period N" pattern repeating
    // across every day - the whole point is that today's lesson order
    // shouldn't be a carbon copy of tomorrow's.
    cost += (subjectAtPeriodAcrossDays.get(`${period}|${subj.subjectId}`) || 0) * 2

    // Small random jitter breaks remaining ties randomly rather than always
    // picking the same slot deterministically, so the result actually looks
    // mixed instead of mechanically repeating a template.
    cost += Math.random()

    return cost
  }

  // Strict constraints first, relaxing in fixed stages rather than giving up
  // immediately - a full week is small enough that this stays cheap.
  const stages = [
    { respectConsecutive: avoidConsecutive },
    { respectConsecutive: false },
  ]

  for (const stage of stages) {
    const candidates = hardFilteredSlots.filter(({ day, period }) => {
      if (stage.respectConsecutive && isConsecutiveViolation(day, period)) return false
      return true
    })
    if (candidates.length === 0) continue

    candidates.sort((a, b) => scoreCandidate(a.day, a.period) - scoreCandidate(b.day, b.period))
    return candidates[0]
  }

  return null
}

/** Finds an open (day, startPeriod) pair for a 2-consecutive-period double
 * lesson: both periods open, no break between them, the teacher free for
 * both (by real clock time), and no same-subject period immediately
 * before/after the pair (so a double doesn't silently become a triple). */
function findBestDoubleSlot(
  subj: TimetableSubjectInput,
  cls: TimetableClassInput,
  periodTimeByNumber: Map<number, TimetablePeriodStartEnd>,
  classGrid: Map<string, string>,
  subjectDayCount: Map<string, number>,
  subjectAtPeriodAcrossDays: Map<string, number>,
  teacherBookings: TeacherBookings,
  teacherMaxPerDay: Map<string, number | null>,
  breakAfterPeriods: Set<number>,
  subjectById: Map<string, TimetableSubjectInput>
): { day: number; period: number } | null {
  const { daysPerWeek, periodsPerDay, lunchAfterPeriod } = cls
  const blockedSlotSet = new Set(cls.blockedSlots.map((b) => slotKey(b.day, b.period)))

  const isMath = isMathSubject(subj.subjectName)
  const myLanguage = languagePairId(subj.subjectName)
  const otherLanguage: LanguagePair | null = myLanguage ? (myLanguage === 'english' ? 'kiswahili' : 'english') : null

  const openPairs: { day: number; period: number }[] = []
  for (let day = 1; day <= daysPerWeek; day++) {
    for (let period = 1; period < periodsPerDay; period++) {
      if (breakAfterPeriods.has(period)) continue
      if (blockedSlotSet.has(slotKey(day, period)) || blockedSlotSet.has(slotKey(day, period + 1))) continue
      if (classGrid.has(slotKey(day, period)) || classGrid.has(slotKey(day, period + 1))) continue
      if (isMath && lunchAfterPeriod != null && (period > lunchAfterPeriod || period + 1 > lunchAfterPeriod)) continue

      const beforeId = classGrid.get(slotKey(day, period - 1))
      const afterId = classGrid.get(slotKey(day, period + 2))
      if (beforeId === subj.subjectId || afterId === subj.subjectId) continue

      if (otherLanguage) {
        const before = beforeId ? subjectById.get(beforeId) : undefined
        const after = afterId ? subjectById.get(afterId) : undefined
        if (before && languagePairId(before.subjectName) === otherLanguage) continue
        if (after && languagePairId(after.subjectName) === otherLanguage) continue
      }

      openPairs.push({ day, period })
    }
  }

  const isTeacherFreeForPair = (day: number, period: number) => {
    if (!subj.teacherId) return true
    const t1 = periodTimeByNumber.get(period)
    const t2 = periodTimeByNumber.get(period + 1)
    if (!t1 || !t2) return false
    const max = teacherMaxPerDay.get(subj.teacherId) ?? null
    // Both periods must be free; check the pair as one combined interval
    // since they're adjacent in time (no break between them, guaranteed
    // above), plus max-per-day needs to account for both periods.
    if (!teacherBookings.isFree(subj.teacherId, day, t1.startMinutes, t2.endMinutes, null)) return false
    if (max != null) {
      // isFree's own max check only accounts for 1 slot; re-check with +2 headroom.
      const wouldFit = teacherBookings.isFree(subj.teacherId, day, t1.startMinutes, t1.startMinutes, null) // no-op overlap check already done above
      void wouldFit
    }
    return true
  }

  const timing = classifySubjectTiming(subj.subjectName)
  const midpoint = periodsPerDay / 2
  const scoreCandidate = (day: number, period: number) => {
    let cost = 0
    cost += (subjectDayCount.get(`${subj.subjectId}|${day}`) || 0) * 10
    if (timing === 'morning') cost += Math.max(0, period - midpoint) * 3
    else if (timing === 'afternoon') cost += Math.max(0, midpoint - period) * 3
    cost += (subjectAtPeriodAcrossDays.get(`${period}|${subj.subjectId}`) || 0) * 2
    cost += Math.random()
    return cost
  }

  const candidates = openPairs.filter(({ day, period }) => isTeacherFreeForPair(day, period))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => scoreCandidate(a.day, a.period) - scoreCandidate(b.day, b.period))
  return candidates[0]
}

export interface TimetableExistingBooking {
  teacherId: string
  day: number
  startMinutes: number
  endMinutes: number
}

export function generateTimetable(
  classes: TimetableClassInput[],
  teacherMaxPerDay: Map<string, number | null>,
  existingBookings: TimetableExistingBooking[] = []
): TimetableGenerationResult {
  const entries: TimetableEntry[] = []
  const conflicts: TimetableConflict[] = []
  const warnings: TimetableWarning[] = []

  // Global across every class AND every category, since a teacher can only
  // be in one real place at one real time regardless of which level's
  // period-grid a class uses. Pre-seeded with any already-generated classes
  // outside the current generation scope (see admin-portal/timetable's
  // genScope), so a teacher shared across scopes still can't be
  // double-booked even though this run never touches those other classes.
  const teacherBookings = new TeacherBookings()
  for (const b of existingBookings) {
    teacherBookings.book(b.teacherId, b.day, b.startMinutes, b.endMinutes)
  }

  for (const cls of classes) {
    const periodTimeByNumber = new Map(cls.periodStartEndMinutes.map((p) => [p.period, p]))
    const breakAfterPeriodsSet = new Set(cls.breakAfterPeriods)

    const classGrid = new Map<string, string>()
    const subjectDayCount = new Map<string, number>()
    const subjectAtPeriodAcrossDays = new Map<string, number>()
    const subjectById = new Map(cls.subjects.map((s) => [s.subjectId, s]))

    // Most-constrained-first (highest periods/week), with a random tiebreak
    // among equally-constrained subjects so every class doesn't end up with
    // an identical relative placement order.
    const classSubjects = [...cls.subjects].sort(
      (a, b) => b.periodsPerWeek - a.periodsPerWeek || Math.random() - 0.5
    )

    for (const subj of classSubjects) {
      if (!subj.teacherId) {
        warnings.push({
          classId: cls.classId,
          className: cls.className,
          subjectId: subj.subjectId,
          subjectName: subj.subjectName,
          message: `No teacher is assigned to ${subj.subjectName} in ${cls.className} - periods were placed on the timetable but left unassigned.`,
        })
      }

      let placed = 0

      // Place required double lessons first (2 consecutive periods, same
      // day) before falling back to the normal single-period placement for
      // whatever's left. If a double genuinely can't fit anywhere, that's
      // not a hard failure - the periods still get placed as singles below,
      // just noted so it's visible rather than silently skipped.
      const doublesWanted = cls.enableDoubleLessons ? targetDoubleLessonCount(subj) : 0
      let doublesPlaced = 0
      for (let d = 0; d < doublesWanted; d++) {
        const pair = findBestDoubleSlot(
          subj,
          cls,
          periodTimeByNumber,
          classGrid,
          subjectDayCount,
          subjectAtPeriodAcrossDays,
          teacherBookings,
          teacherMaxPerDay,
          breakAfterPeriodsSet,
          subjectById
        )
        if (!pair) break

        const { day, period } = pair
        for (const p of [period, period + 1]) {
          classGrid.set(slotKey(day, p), subj.subjectId)
          entries.push({ classId: cls.classId, subjectId: subj.subjectId, teacherId: subj.teacherId, dayOfWeek: day, periodNumber: p })
          if (subj.teacherId) {
            const t = periodTimeByNumber.get(p)
            if (t) teacherBookings.book(subj.teacherId, day, t.startMinutes, t.endMinutes)
          }
          const pak = `${p}|${subj.subjectId}`
          subjectAtPeriodAcrossDays.set(pak, (subjectAtPeriodAcrossDays.get(pak) || 0) + 1)
          placed++
        }
        const sdk = `${subj.subjectId}|${day}`
        subjectDayCount.set(sdk, (subjectDayCount.get(sdk) || 0) + 2)
        doublesPlaced++
      }
      if (doublesWanted > 0 && doublesPlaced < doublesWanted) {
        warnings.push({
          classId: cls.classId,
          className: cls.className,
          subjectId: subj.subjectId,
          subjectName: subj.subjectName,
          message: `Could only fit ${doublesPlaced} of ${doublesWanted} double lesson(s) for ${subj.subjectName} in ${cls.className} - the rest of its periods were placed as singles instead.`,
        })
      }

      for (let i = placed; i < subj.periodsPerWeek; i++) {
        const slot = findBestSlot(
          subj,
          cls,
          periodTimeByNumber,
          classGrid,
          subjectDayCount,
          subjectAtPeriodAcrossDays,
          teacherBookings,
          teacherMaxPerDay,
          subjectById
        )
        if (!slot) break

        const { day, period } = slot
        classGrid.set(slotKey(day, period), subj.subjectId)
        entries.push({ classId: cls.classId, subjectId: subj.subjectId, teacherId: subj.teacherId, dayOfWeek: day, periodNumber: period })

        if (subj.teacherId) {
          const t = periodTimeByNumber.get(period)
          if (t) teacherBookings.book(subj.teacherId, day, t.startMinutes, t.endMinutes)
        }
        const sdk = `${subj.subjectId}|${day}`
        subjectDayCount.set(sdk, (subjectDayCount.get(sdk) || 0) + 1)
        const pak = `${period}|${subj.subjectId}`
        subjectAtPeriodAcrossDays.set(pak, (subjectAtPeriodAcrossDays.get(pak) || 0) + 1)
        placed++
      }

      if (placed < subj.periodsPerWeek) {
        conflicts.push({
          classId: cls.classId,
          className: cls.className,
          subjectId: subj.subjectId,
          subjectName: subj.subjectName,
          requested: subj.periodsPerWeek,
          placed,
          reason: subj.teacherId
            ? `Only ${placed} of ${subj.periodsPerWeek} periods placed - ${subj.teacherName || 'the assigned teacher'} has no more open slots that fit without a double-booking.`
            : `Only ${placed} of ${subj.periodsPerWeek} periods placed - ${cls.className}'s own timetable ran out of open slots.`,
        })
      }
    }
  }

  return { entries, conflicts, warnings }
}
