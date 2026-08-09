// Pure, DB-free timetable scheduling engine. Runs client-side, same as this
// app's other heavy computation (school-analysis-report.ts, marklist
// rankings) - no server compute budget concerns, no new API route needed.
//
// Approach: sequential greedy placement with constraint relaxation, most-
// constrained-subject-first, tracking teacher occupancy globally across every
// class so two classes can never be assigned the same teacher at the same
// slot. Not globally optimal, but always valid (no double-bookings) and any
// period that genuinely can't be placed is reported, never silently dropped.

export interface TimetableSubjectInput {
  subjectId: string
  subjectName: string
  periodsPerWeek: number
  teacherId: string | null
  teacherName: string | null
}

export interface TimetableClassInput {
  classId: string
  className: string
  subjects: TimetableSubjectInput[]
}

export interface TimetableSettingsInput {
  daysPerWeek: number
  periodsPerDay: number
  avoidConsecutiveSameSubject: boolean
  spreadEvenly: boolean
  /** Period numbers that have a break immediately after them - a double
   * lesson can never be placed across one of these. */
  breakAfterPeriods: number[]
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

function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** Teaching periods that fit in a day, after subtracting break time. */
export function computePeriodsPerDay(
  schoolStartTime: string,
  schoolEndTime: string,
  periodLengthMinutes: number,
  breaks: { durationMinutes: number }[]
): number {
  const totalMinutes = timeStringToMinutes(schoolEndTime) - timeStringToMinutes(schoolStartTime)
  const totalBreakMinutes = breaks.reduce((sum, b) => sum + b.durationMinutes, 0)
  const teachingMinutes = Math.max(0, totalMinutes - totalBreakMinutes)
  return periodLengthMinutes > 0 ? Math.floor(teachingMinutes / periodLengthMinutes) : 0
}

export interface TimetablePeriodTime {
  period: number
  startTime: string
  endTime: string
}

/** Clock start/end time for every teaching period, accounting for where breaks fall. */
export function computePeriodTimes(
  schoolStartTime: string,
  periodLengthMinutes: number,
  periodsPerDay: number,
  breaks: { afterPeriodNumber: number; durationMinutes: number }[]
): TimetablePeriodTime[] {
  const breakAfterPeriod = new Map(breaks.map((b) => [b.afterPeriodNumber, b.durationMinutes]))
  let cursor = timeStringToMinutes(schoolStartTime)
  const result: TimetablePeriodTime[] = []
  for (let period = 1; period <= periodsPerDay; period++) {
    const start = cursor
    const end = start + periodLengthMinutes
    result.push({ period, startTime: minutesToTimeString(start), endTime: minutesToTimeString(end) })
    cursor = end
    const breakMinutes = breakAfterPeriod.get(period)
    if (breakMinutes) cursor += breakMinutes
  }
  return result
}

const slotKey = (day: number, period: number) => `${day}|${period}`
const teacherSlotKey = (teacherId: string, day: number, period: number) => `${teacherId}|${day}|${period}`
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

function findBestSlot(
  subj: TimetableSubjectInput,
  classGrid: Map<string, string>,
  subjectDayCount: Map<string, number>,
  subjectAtPeriodAcrossDays: Map<string, number>,
  teacherBusy: Set<string>,
  teacherDayCount: Map<string, number>,
  teacherMaxPerDay: Map<string, number | null>,
  daysPerWeek: number,
  periodsPerDay: number,
  avoidConsecutive: boolean,
  spreadEvenly: boolean
): { day: number; period: number } | null {
  const openSlots: { day: number; period: number }[] = []
  for (let day = 1; day <= daysPerWeek; day++) {
    for (let period = 1; period <= periodsPerDay; period++) {
      if (!classGrid.has(slotKey(day, period))) openSlots.push({ day, period })
    }
  }

  const isTeacherFree = (day: number, period: number) => {
    if (!subj.teacherId) return true
    if (teacherBusy.has(teacherSlotKey(subj.teacherId, day, period))) return false
    const max = teacherMaxPerDay.get(subj.teacherId)
    if (max != null) {
      const current = teacherDayCount.get(teacherDayKey(subj.teacherId, day)) || 0
      if (current >= max) return false
    }
    return true
  }

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
    const candidates = openSlots.filter(({ day, period }) => {
      if (!isTeacherFree(day, period)) return false
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
 * both, and no same-subject period immediately before/after the pair (so a
 * double doesn't silently become a triple). */
function findBestDoubleSlot(
  subj: TimetableSubjectInput,
  classGrid: Map<string, string>,
  subjectDayCount: Map<string, number>,
  subjectAtPeriodAcrossDays: Map<string, number>,
  teacherBusy: Set<string>,
  teacherDayCount: Map<string, number>,
  teacherMaxPerDay: Map<string, number | null>,
  daysPerWeek: number,
  periodsPerDay: number,
  breakAfterPeriods: Set<number>
): { day: number; period: number } | null {
  const openPairs: { day: number; period: number }[] = []
  for (let day = 1; day <= daysPerWeek; day++) {
    for (let period = 1; period < periodsPerDay; period++) {
      if (breakAfterPeriods.has(period)) continue
      if (classGrid.has(slotKey(day, period)) || classGrid.has(slotKey(day, period + 1))) continue
      const before = classGrid.get(slotKey(day, period - 1))
      const after = classGrid.get(slotKey(day, period + 2))
      if (before === subj.subjectId || after === subj.subjectId) continue
      openPairs.push({ day, period })
    }
  }

  const isTeacherFreeForPair = (day: number, period: number) => {
    if (!subj.teacherId) return true
    if (
      teacherBusy.has(teacherSlotKey(subj.teacherId, day, period)) ||
      teacherBusy.has(teacherSlotKey(subj.teacherId, day, period + 1))
    ) {
      return false
    }
    const max = teacherMaxPerDay.get(subj.teacherId)
    if (max != null) {
      const current = teacherDayCount.get(teacherDayKey(subj.teacherId, day)) || 0
      if (current + 2 > max) return false
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

export function generateTimetable(
  classes: TimetableClassInput[],
  teacherMaxPerDay: Map<string, number | null>,
  settings: TimetableSettingsInput
): TimetableGenerationResult {
  const { daysPerWeek, periodsPerDay, avoidConsecutiveSameSubject, spreadEvenly, breakAfterPeriods } = settings
  const breakAfterPeriodsSet = new Set(breakAfterPeriods)
  const entries: TimetableEntry[] = []
  const conflicts: TimetableConflict[] = []
  const warnings: TimetableWarning[] = []

  // Global across every class, since a teacher can only be in one place at once.
  const teacherBusy = new Set<string>()
  const teacherDayCount = new Map<string, number>()

  for (const cls of classes) {
    const classGrid = new Map<string, string>()
    const subjectDayCount = new Map<string, number>()
    const subjectAtPeriodAcrossDays = new Map<string, number>()

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
      const doublesWanted = targetDoubleLessonCount(subj)
      let doublesPlaced = 0
      for (let d = 0; d < doublesWanted; d++) {
        const pair = findBestDoubleSlot(
          subj,
          classGrid,
          subjectDayCount,
          subjectAtPeriodAcrossDays,
          teacherBusy,
          teacherDayCount,
          teacherMaxPerDay,
          daysPerWeek,
          periodsPerDay,
          breakAfterPeriodsSet
        )
        if (!pair) break

        const { day, period } = pair
        for (const p of [period, period + 1]) {
          classGrid.set(slotKey(day, p), subj.subjectId)
          entries.push({ classId: cls.classId, subjectId: subj.subjectId, teacherId: subj.teacherId, dayOfWeek: day, periodNumber: p })
          if (subj.teacherId) teacherBusy.add(teacherSlotKey(subj.teacherId, day, p))
          const pak = `${p}|${subj.subjectId}`
          subjectAtPeriodAcrossDays.set(pak, (subjectAtPeriodAcrossDays.get(pak) || 0) + 1)
          placed++
        }
        if (subj.teacherId) {
          const dk = teacherDayKey(subj.teacherId, day)
          teacherDayCount.set(dk, (teacherDayCount.get(dk) || 0) + 2)
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
          classGrid,
          subjectDayCount,
          subjectAtPeriodAcrossDays,
          teacherBusy,
          teacherDayCount,
          teacherMaxPerDay,
          daysPerWeek,
          periodsPerDay,
          avoidConsecutiveSameSubject,
          spreadEvenly
        )
        if (!slot) break

        const { day, period } = slot
        classGrid.set(slotKey(day, period), subj.subjectId)
        entries.push({ classId: cls.classId, subjectId: subj.subjectId, teacherId: subj.teacherId, dayOfWeek: day, periodNumber: period })

        if (subj.teacherId) {
          teacherBusy.add(teacherSlotKey(subj.teacherId, day, period))
          const dk = teacherDayKey(subj.teacherId, day)
          teacherDayCount.set(dk, (teacherDayCount.get(dk) || 0) + 1)
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
