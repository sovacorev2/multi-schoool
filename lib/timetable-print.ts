// Printable timetable HTML. Same window.open + write HTML + window.print()
// pattern as lib/school-analysis-report.ts and every other printable report
// in this app.

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface TimetablePrintCell {
  subjectName: string
  subtitle: string | null
}

export interface TimetablePrintPeriodTime {
  period: number
  startTime: string
  endTime: string
}

/** Same explicit-column escape hatch as components/timetable-grid.tsx - used
 * for a merged cross-category axis (e.g. a teacher printing their schedule
 * across levels that run different daily structures). No break columns in
 * this mode, since break patterns aren't shared across levels. */
export interface TimetablePrintColumn {
  key: string
  label: string
  subLabel: string
}

type Column =
  | { type: 'period'; key: string; label: string; subLabel: string }
  | { type: 'break'; key: string; label: string; subLabel: string }

export function generateTimetablePrintHTML(params: {
  title: string
  schoolName: string
  termLabel: string
  daysPerWeek: number
  periodsPerDay?: number
  breaks?: { name: string; afterPeriodNumber: number; durationMinutes: number }[]
  periodTimes?: TimetablePrintPeriodTime[]
  columns?: TimetablePrintColumn[]
  cells: Record<string, TimetablePrintCell>
}): string {
  const { title, schoolName, termLabel, daysPerWeek, periodsPerDay, breaks, periodTimes, columns: explicitColumns, cells } = params
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

  const headerCellsHTML = columns
    .map((col) =>
      col.type === 'period'
        ? `<th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;">${col.label}<br/><span style="font-weight:400;color:#6b7280;font-size:10px;">${col.subLabel}</span></th>`
        : `<th style="border:1px solid #d1d5db;padding:4px;background:#fef3c7;color:#b45309;font-size:10px;white-space:nowrap;">${col.label}<br/>${col.subLabel}</th>`
    )
    .join('')

  const rowsHTML = dayLabels
    .map((label, dayIdx) => {
      const day = dayIdx + 1
      const rowCellsHTML = columns
        .map((col) => {
          if (col.type === 'break') return `<td style="border:1px solid #d1d5db;background:#fffbeb;"></td>`
          const cell = cells[`${day}|${col.key}`]
          return `<td style="border:1px solid #d1d5db;padding:6px 8px;vertical-align:top;">${
            cell
              ? `<div style="font-weight:700;">${cell.subjectName}</div><div style="color:#6b7280;font-size:10px;">${cell.subtitle || ''}</div>`
              : '<span style="color:#d1d5db;">-</span>'
          }</td>`
        })
        .join('')
      return `<tr>
        <td style="border:1px solid #d1d5db;padding:6px 8px;background:#f9fafb;font-weight:600;white-space:nowrap;">${label}</td>
        ${rowCellsHTML}
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 12px; color: #111827; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 { font-size: 13px; font-weight: 500; color: #4b5563; margin: 0; }
  .meta { font-size: 11px; color: #4b5563; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 10px; }
  th, td { word-wrap: break-word; overflow-wrap: break-word; }
  td:first-child, th:first-child { width: 60px; }
  @media print {
    body { padding: 0; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${title}</h1>
  <h2>${schoolName}</h2>
  <div class="meta">${termLabel} &bull; Printed: ${new Date().toLocaleDateString()}</div>
  <table>
    <thead><tr><th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;">Day</th>${headerCellsHTML}</tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
</body>
</html>`
}

export interface BlockTimetableCell {
  subjectName: string
  teacherInitials: string
}

export interface BlockTimetableRow {
  className: string
  /** Keyed by column key, same as TimetablePrintColumn.key. */
  cells: Record<string, BlockTimetableCell>
}

export interface BlockTimetableSection {
  /** e.g. "Junior Secondary - Monday" - each level has its own period grid, so its own columns too. */
  sectionLabel: string
  columns: TimetablePrintColumn[]
  rows: BlockTimetableRow[]
}

/** A whole-school "master timetable" - classes as rows, periods as columns,
 * one section per CBC level per day (a level runs its own day structure, so
 * levels are never merged into one grid), each cell showing the subject and
 * the teacher's initials (full names don't fit at this density) - with one
 * shared legend mapping initials back to full names. Sections are never
 * squeezed onto one page - each starts a fresh printed page, however many
 * pages that ends up taking. */
export function generateBlockTimetablePrintHTML(params: {
  title: string
  schoolName: string
  termLabel: string
  sections: BlockTimetableSection[]
  legend: { initials: string; name: string }[]
}): string {
  const { title, schoolName, termLabel, sections, legend } = params

  const sectionsHTML = sections
    .map((section, sectionIdx) => {
      const headerCellsHTML = section.columns
        .map((col) => `<th style="border:1px solid #d1d5db;padding:4px 6px;background:#e5e7eb;">${col.label}<br/><span style="font-weight:400;color:#6b7280;font-size:9px;">${col.subLabel}</span></th>`)
        .join('')

      const rowsHTML = section.rows
        .map((row) => {
          const rowCellsHTML = section.columns
            .map((col) => {
              const cell = row.cells[col.key]
              return `<td style="border:1px solid #d1d5db;padding:3px 5px;vertical-align:top;">${
                cell
                  ? `<div style="font-weight:700;">${cell.subjectName}</div><div style="color:#1d4ed8;font-size:10px;font-weight:600;">${cell.teacherInitials}</div>`
                  : '<span style="color:#d1d5db;">-</span>'
              }</td>`
            })
            .join('')
          return `<tr>
            <td style="border:1px solid #d1d5db;padding:3px 6px;background:#f9fafb;font-weight:600;white-space:nowrap;">${row.className}</td>
            ${rowCellsHTML}
          </tr>`
        })
        .join('')

      return `<div${sectionIdx > 0 ? ' style="page-break-before: always; margin-top: 16px;"' : ''}>
        <h2>${schoolName} - ${section.sectionLabel}</h2>
        <table>
          <thead><tr><th style="border:1px solid #d1d5db;padding:4px 6px;background:#e5e7eb;">Class</th>${headerCellsHTML}</tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>`
    })
    .join('')

  const legendHTML = legend
    .map((l) => `<span style="display:inline-block;margin:2px 10px 2px 0;"><b style="color:#1d4ed8;">${l.initials}</b> = ${l.name}</span>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  @page { size: A3 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 12px; color: #111827; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 { font-size: 13px; font-weight: 500; color: #4b5563; margin: 0; }
  .meta { font-size: 11px; color: #4b5563; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 9px; }
  th, td { word-wrap: break-word; overflow-wrap: break-word; }
  td:first-child, th:first-child { width: 90px; }
  .legend { margin-top: 14px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 10px; color: #374151; }
  .legend-title { font-weight: 700; margin-bottom: 4px; }
  @media print {
    body { padding: 0; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${termLabel} &bull; Printed: ${new Date().toLocaleDateString()}</div>
  ${sectionsHTML}
  <div class="legend">
    <div class="legend-title">Teacher Initials</div>
    ${legendHTML}
  </div>
</body>
</html>`
}

export function openTimetablePrintWindow(html: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => setTimeout(() => win.print(), 300)
}
