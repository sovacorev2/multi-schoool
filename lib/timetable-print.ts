// Printable timetable HTML. Same window.open + write HTML + window.print()
// pattern as lib/school-analysis-report.ts and every other printable report
// in this app.

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface TimetablePrintCell {
  subjectName: string
  subtitle: string | null
}

export function generateTimetablePrintHTML(params: {
  title: string
  schoolName: string
  termLabel: string
  daysPerWeek: number
  periodsPerDay: number
  breaks: { name: string; afterPeriodNumber: number; durationMinutes: number }[]
  cells: Record<string, TimetablePrintCell>
}): string {
  const { title, schoolName, termLabel, daysPerWeek, periodsPerDay, breaks, cells } = params
  const dayLabels = DAY_LABELS.slice(0, daysPerWeek)
  const breaksByPeriod = new Map(breaks.map((b) => [b.afterPeriodNumber, b]))

  let rowsHTML = ''
  for (let period = 1; period <= periodsPerDay; period++) {
    const dayCellsHTML = dayLabels
      .map((_, dayIdx) => {
        const day = dayIdx + 1
        const cell = cells[`${day}|${period}`]
        return `<td style="border:1px solid #d1d5db;padding:6px 8px;vertical-align:top;">${
          cell
            ? `<div style="font-weight:700;">${cell.subjectName}</div><div style="color:#6b7280;font-size:10px;">${cell.subtitle || ''}</div>`
            : '<span style="color:#d1d5db;">-</span>'
        }</td>`
      })
      .join('')

    rowsHTML += `<tr>
      <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;background:#f9fafb;font-weight:600;">${period}</td>
      ${dayCellsHTML}
    </tr>`

    const brk = breaksByPeriod.get(period)
    if (brk) {
      rowsHTML += `<tr>
        <td colspan="${dayLabels.length + 1}" style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;background:#fffbeb;color:#b45309;font-weight:600;font-size:11px;">
          ${brk.name} (${brk.durationMinutes} min)
        </td>
      </tr>`
    }
  }

  const headerCellsHTML = dayLabels.map((label) => `<th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;">${label}</th>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 500; color: #4b5563; margin-top: 0; }
  .meta { font-size: 12px; color: #4b5563; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <h2>${schoolName}</h2>
  <div class="meta">${termLabel} &bull; Printed: ${new Date().toLocaleDateString()}</div>
  <table>
    <thead><tr><th style="border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;">Period</th>${headerCellsHTML}</tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
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
