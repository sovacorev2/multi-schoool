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

function findBestSlot(
  subj: TimetableSubjectInput,
  classGrid: Map<string, string>,
  subjectDayCount: Map<string, number>,
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

  // Strict constraints first, relaxing in fixed stages rather than giving up
  // immediately - a full week is small enough that this stays cheap.
  const stages = [
    { respectConsecutive: avoidConsecutive, preferSpread: spreadEvenly },
    { respectConsecutive: false, preferSpread: spreadEvenly },
    { respectConsecutive: false, preferSpread: false },
  ]

  for (const stage of stages) {
    const candidates = openSlots.filter(({ day, period }) => {
      if (!isTeacherFree(day, period)) return false
      if (stage.respectConsecutive && isConsecutiveViolation(day, period)) return false
      return true
    })
    if (candidates.length === 0) continue

    if (stage.preferSpread) {
      candidates.sort((a, b) => {
        const countA = subjectDayCount.get(`${subj.subjectId}|${a.day}`) || 0
        const countB = subjectDayCount.get(`${subj.subjectId}|${b.day}`) || 0
        return countA - countB
      })
    }

    return candidates[0]
  }

  return null
}

export function generateTimetable(
  classes: TimetableClassInput[],
  teacherMaxPerDay: Map<string, number | null>,
  settings: TimetableSettingsInput
): TimetableGenerationResult {
  const { daysPerWeek, periodsPerDay, avoidConsecutiveSameSubject, spreadEvenly } = settings
  const entries: TimetableEntry[] = []
  const conflicts: TimetableConflict[] = []
  const warnings: TimetableWarning[] = []

  // Global across every class, since a teacher can only be in one place at once.
  const teacherBusy = new Set<string>()
  const teacherDayCount = new Map<string, number>()

  for (const cls of classes) {
    const classGrid = new Map<string, string>()
    const subjectDayCount = new Map<string, number>()

    const classSubjects = [...cls.subjects].sort((a, b) => b.periodsPerWeek - a.periodsPerWeek)

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
      for (let i = 0; i < subj.periodsPerWeek; i++) {
        const slot = findBestSlot(
          subj,
          classGrid,
          subjectDayCount,
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
