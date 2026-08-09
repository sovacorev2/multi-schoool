'use client'

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface TimetableGridCell {
  subjectId: string
  subjectName: string
  teacherId: string | null
  /** Second line under the subject name - teacher name in the class view, class name in the teacher view. */
  subtitle: string | null
}

export interface TimetableGridBreak {
  name: string
  afterPeriodNumber: number
  durationMinutes: number
}

export interface TimetableGridPeriodTime {
  period: number
  startTime: string
  endTime: string
}

type Column =
  | { type: 'period'; period: number; startTime: string; endTime: string }
  | { type: 'break'; key: string; name: string; durationMinutes: number }

export function TimetableGrid({
  daysPerWeek,
  periodsPerDay,
  breaks,
  periodTimes,
  cells,
  onCellClick,
}: {
  daysPerWeek: number
  periodsPerDay: number
  breaks: TimetableGridBreak[]
  periodTimes: TimetableGridPeriodTime[]
  /** Keyed by "day|period" (1-based). */
  cells: Record<string, TimetableGridCell>
  onCellClick?: (day: number, period: number, cell: TimetableGridCell | null) => void
}) {
  const dayLabels = DAY_LABELS.slice(0, daysPerWeek)
  const breaksByAfterPeriod = new Map(breaks.map((b) => [b.afterPeriodNumber, b]))
  const timeByPeriod = new Map(periodTimes.map((p) => [p.period, p]))

  const columns: Column[] = []
  for (let period = 1; period <= periodsPerDay; period++) {
    const t = timeByPeriod.get(period)
    columns.push({ type: 'period', period, startTime: t?.startTime || '', endTime: t?.endTime || '' })
    const brk = breaksByAfterPeriod.get(period)
    if (brk) columns.push({ type: 'break', key: `break-${period}`, name: brk.name, durationMinutes: brk.durationMinutes })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 px-2 py-2 bg-gray-100 text-xs">Day</th>
            {columns.map((col) =>
              col.type === 'period' ? (
                <th key={`p-${col.period}`} className="border border-gray-300 px-2 py-2 bg-gray-100 text-xs min-w-[100px]">
                  <div>Period {col.period}</div>
                  <div className="font-normal text-gray-500">{col.startTime} - {col.endTime}</div>
                </th>
              ) : (
                <th key={col.key} className="border border-gray-300 px-1 py-2 bg-amber-100 text-[10px] text-amber-700 whitespace-nowrap">
                  {col.name}
                  <br />
                  ({col.durationMinutes}m)
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {dayLabels.map((label, dayIdx) => {
            const day = dayIdx + 1
            return (
              <tr key={day}>
                <td className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-50 whitespace-nowrap">{label}</td>
                {columns.map((col) => {
                  if (col.type === 'break') {
                    return <td key={col.key} className="border border-gray-300 bg-amber-50"></td>
                  }
                  const cell = cells[`${day}|${col.period}`] || null
                  const clickable = !!onCellClick
                  return (
                    <td
                      key={col.period}
                      onClick={() => onCellClick?.(day, col.period, cell)}
                      className={`border border-gray-300 px-2 py-2 text-xs align-top ${clickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                    >
                      {cell ? (
                        <div>
                          <div className="font-medium text-gray-900">{cell.subjectName}</div>
                          <div className="text-gray-500">{cell.subtitle || (cell.teacherId ? '' : 'No teacher')}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
