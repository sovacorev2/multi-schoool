'use client'

import type { ReactNode } from 'react'

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

export function TimetableGrid({
  daysPerWeek,
  periodsPerDay,
  breaks,
  cells,
  onCellClick,
}: {
  daysPerWeek: number
  periodsPerDay: number
  breaks: TimetableGridBreak[]
  /** Keyed by "day|period" (1-based). */
  cells: Record<string, TimetableGridCell>
  onCellClick?: (day: number, period: number, cell: TimetableGridCell | null) => void
}) {
  const dayLabels = DAY_LABELS.slice(0, daysPerWeek)
  const breaksByPeriod = new Map(breaks.map((b) => [b.afterPeriodNumber, b]))

  const rows: ReactNode[] = []
  for (let period = 1; period <= periodsPerDay; period++) {
    rows.push(
      <tr key={`period-${period}`}>
        <td className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-500 text-center bg-gray-50">
          {period}
        </td>
        {dayLabels.map((_, dayIdx) => {
          const day = dayIdx + 1
          const cell = cells[`${day}|${period}`] || null
          const clickable = !!onCellClick
          return (
            <td
              key={day}
              onClick={() => onCellClick?.(day, period, cell)}
              className={`border border-gray-300 px-2 py-2 text-xs align-top min-w-[100px] ${clickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
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

    const brk = breaksByPeriod.get(period)
    if (brk) {
      rows.push(
        <tr key={`break-${period}`} className="bg-amber-50">
          <td colSpan={dayLabels.length + 1} className="border border-gray-300 px-2 py-1 text-[11px] font-medium text-amber-700 text-center">
            {brk.name} ({brk.durationMinutes} min)
          </td>
        </tr>
      )
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 px-2 py-2 bg-gray-100 text-xs">Period</th>
            {dayLabels.map((label) => (
              <th key={label} className="border border-gray-300 px-2 py-2 bg-gray-100 text-xs">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}
