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

/** An explicit, pre-built column - used instead of periodsPerDay/breaks/periodTimes
 * when a grid needs to show a merged axis spanning more than one CBC level's
 * period structure (e.g. a teacher whose classes span Junior Secondary and
 * Pre-School, which run on different clock-time grids). No break columns in
 * this mode - each level's break pattern is its own, so there's no single
 * shared break position to show. */
export interface TimetableGridColumn {
  key: string
  label: string
  subLabel: string
}

type Column =
  | { type: 'period'; key: string; label: string; subLabel: string }
  | { type: 'break'; key: string; label: string; subLabel: string }

export function TimetableGrid({
  daysPerWeek,
  periodsPerDay,
  breaks,
  periodTimes,
  columns: explicitColumns,
  cells,
  onCellClick,
}: {
  daysPerWeek: number
  periodsPerDay?: number
  breaks?: TimetableGridBreak[]
  periodTimes?: TimetableGridPeriodTime[]
  /** When provided, overrides periodsPerDay/breaks/periodTimes entirely - see TimetableGridColumn. */
  columns?: TimetableGridColumn[]
  /** Keyed by "day|<column key>" - the column key is the period number (as a string) in normal mode, or the explicit column's own key in merged mode. */
  cells: Record<string, TimetableGridCell>
  onCellClick?: (day: number, period: number, cell: TimetableGridCell | null) => void
}) {
  const dayLabels = DAY_LABELS.slice(0, daysPerWeek)

  let columns: Column[]
  if (explicitColumns) {
    columns = explicitColumns.map((c) => ({ type: 'period', key: c.key, label: c.label, subLabel: c.subLabel }))
  } else {
    const breaksByAfterPeriod = new Map((breaks || []).map((b) => [b.afterPeriodNumber, b]))
    const timeByPeriod = new Map((periodTimes || []).map((p) => [p.period, p]))
    columns = []
    for (let period = 1; period <= (periodsPerDay || 0); period++) {
      const t = timeByPeriod.get(period)
      columns.push({ type: 'period', key: String(period), label: `Period ${period}`, subLabel: `${t?.startTime || ''} - ${t?.endTime || ''}` })
      const brk = breaksByAfterPeriod.get(period)
      if (brk) columns.push({ type: 'break', key: `break-${period}`, label: brk.name, subLabel: `(${brk.durationMinutes}m)` })
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 px-2 py-2 bg-gray-100 text-xs">Day</th>
            {columns.map((col) =>
              col.type === 'period' ? (
                <th key={`p-${col.key}`} className="border border-gray-300 px-2 py-2 bg-gray-100 text-xs min-w-[100px]">
                  <div>{col.label}</div>
                  <div className="font-normal text-gray-500">{col.subLabel}</div>
                </th>
              ) : (
                <th key={col.key} className="border border-gray-300 px-1 py-2 bg-amber-100 text-[10px] text-amber-700 whitespace-nowrap">
                  {col.label}
                  <br />
                  {col.subLabel}
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
                  const cell = cells[`${day}|${col.key}`] || null
                  const clickable = !!onCellClick
                  return (
                    <td
                      key={col.key}
                      onClick={() => onCellClick?.(day, Number(col.key), cell)}
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
