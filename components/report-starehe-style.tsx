'use client'

import { useSchool } from '@/lib/school-context'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Printer, Download } from 'lucide-react'
import { getGradeLevelByClass, isUpperClass, GRADING_SCALE_SIMPLE, GRADING_SCALE_EXTENDED } from '@/lib/grading-utils'

interface StudentReport {
  learner: { id: string; name: string; admission_number: string | null; gender?: string; parent_phone?: string | null }
  marks: Record<string, number | null>
  subjectPositions?: Record<string, number>
  total: number
  rank: number
  average: number
  streamRank?: number
  streamTotal?: number
}

interface Subject {
  id: string
  name: string
}

interface SessionInfo {
  year: number
  term: number
  exam_types?: { name: string }
}

interface TermHistory {
  term: number
  year: number
  total: number
  average: number
  rank: number
  streamRank?: number
  daysAbsent?: number
}

interface ReportStareheStyleProps {
  isOpen: boolean
  onClose: () => void
  reports: StudentReport[]
  subjects: Subject[]
  sessionInfo: SessionInfo | null
  className: string
  totalStudents: number
  termHistory?: Record<string, TermHistory[]>
  classTeacherName?: string | null
}

// CBC Performance Level helper
function getCBCPerformanceLevel(score: number, className: string): { level: string; points: number } {
  const result = getGradeLevelByClass(score, className)
  return result || { level: '-', points: 0 }
}

// Get full description for CBC performance level
function getCBCLevelDescription(level: string): string {
  if (level.startsWith('EE')) return 'Exceeding Expectation'
  if (level.startsWith('ME')) return 'Meeting Expectation'
  if (level.startsWith('AE')) return 'Approaching Expectation'
  if (level.startsWith('BE')) return 'Below Expectation'
  return ''
}

// Helper function to get CBC remarks based on performance level
function getCBCRemarks(score: number | null, className: string): string {
  if (score === null || score === undefined) return 'No data'
  const perf = getCBCPerformanceLevel(score, className)
  if (perf.level.startsWith('EE')) return 'Exceptional performance'
  if (perf.level.startsWith('ME')) return 'Good performance'
  if (perf.level.startsWith('AE')) return 'Fair performance, continue practicing'
  if (perf.level.startsWith('BE')) return 'Needs improvement, seek help'
  return ''
}

export function ReportStareheStyle({
  isOpen,
  onClose,
  reports,
  subjects,
  sessionInfo,
  className,
  totalStudents,
  termHistory = {},
  classTeacherName
}: ReportStareheStyleProps) {
  const { currentSchool } = useSchool()
  const reportRef = useRef<HTMLDivElement>(null)

  if (!isOpen || reports.length === 0) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex items-start justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl my-8 w-full max-w-5xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            CBE Report Cards ({reports.length} student{reports.length !== 1 ? 's' : ''})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex gap-3 p-4 border-b bg-gray-50">
          <Button
            onClick={() => {
              if (reportRef.current) {
                const printWindow = window.open('', '', 'width=900,height=1200')
                if (printWindow) {
                  const printCSS = `
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      html, body { margin: 0; padding: 0; height: 100%; }
                      body { font-family: 'Times New Roman', serif; font-size: 12px; line-height: 1.4; background: white; }
                      @page { size: A4; margin: 5mm; }
                      .page-break { page-break-after: always; page-break-inside: avoid; }
                      .hidden { display: none; }
                      .print\\:table { display: table; }
                      img { max-width: 100%; height: auto; display: block; }
                      table { width: 100%; border-collapse: collapse; font-size: inherit; margin-bottom: 10px; }
                      th, td { border: 1px solid #333; padding: 6px; word-break: break-word; }
                      th { background-color: #ddd; font-weight: bold; }
                      tr { orphans: 2; widows: 2; }
                      svg { display: block; margin: 0 auto; max-width: 100%; }
                      .text-center { text-align: center; }
                      .text-left { text-align: left; }
                      .text-xs { font-size: 11px; }
                      .text-sm { font-size: 12px; }
                      .text-lg { font-size: 14px; }
                      .font-bold { font-weight: bold; }
                      .italic { font-style: italic; }
                      .uppercase { text-transform: uppercase; }
                      .border { border: 1px solid #333; }
                      .border-2 { border: 2px solid #333; }
                      .border-b-2 { border-bottom: 2px solid #333; }
                      .border-r-2 { border-right: 2px solid #333; }
                      .border-b { border-bottom: 1px solid #333; }
                      .border-t { border-top: 1px solid #333; }
                      .p-1 { padding: 4px; }
                      .p-2 { padding: 8px; }
                      .p-3 { padding: 12px; }
                      .p-4 { padding: 16px; }
                      .mb-1 { margin-bottom: 4px; }
                      .mb-2 { margin-bottom: 8px; }
                      .mb-3 { margin-bottom: 12px; }
                      .mb-4 { margin-bottom: 16px; }
                      .mt-1 { margin-top: 4px; }
                      .mt-2 { margin-top: 8px; }
                      .mt-0\.5 { margin-top: 2px; }
                      .gap-3 { gap: 12px; }
                      .bg-white { background-color: white; }
                      .bg-gray-50 { background-color: #f9f9f9; }
                      .bg-gray-100 { background-color: #f3f3f3; }
                      .bg-gray-200 { background-color: #e5e5e5; }
                      .bg-yellow-100 { background-color: #fef3c7; }
                      .grid { display: grid; }
                      .grid-cols-2 { grid-template-columns: 1fr 1fr; }
                      .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
                      .mx-auto { margin-left: auto; margin-right: auto; }
                      .object-contain { object-fit: contain; }
                      .text-blue-900 { color: #1e3a8a; }
                      .text-gray-700 { color: #374151; }
                      .text-gray-600 { color: #4b5563; }
                      .text-gray-500 { color: #6b7280; }
                      .tracking-widest { letter-spacing: 0.05em; }
                      .inline-block { display: inline-block; }
                      .flex { display: flex; }
                      .justify-between { justify-content: space-between; }
                      .items-center { align-items: center; }
                      .flex-col { flex-direction: column; }
                      .pb-3 { padding-bottom: 12px; }
                      .pb-1 { padding-bottom: 3px; }
                      .pb-2 { padding-bottom: 8px; }
                      .min-h-6 { min-height: 24px; }
                      .min-h-12 { min-height: 48px; }
                      .min-h-14 { min-height: 56px; }
                      .w-20 { width: 80px; }
                      .h-20 { height: 80px; }
                      .w-32 { width: 128px; }
                      .h-32 { height: 128px; }
                      .space-y-1 > * + * { margin-top: 4px; }
                      .space-y-2 > * + * { margin-top: 8px; }
                      .space-y-0\.5 > * + * { margin-top: 2px; }
                      @media print {
                        body { margin: 0; padding: 0; font-size: 12px; min-height: 100vh; }
                        * { orphans: 3; widows: 3; }
                        img { page-break-inside: avoid; }
                        table { page-break-inside: avoid; }
                      }
                    </style>
                  `
                  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">${printCSS}</head><body>${reportRef.current.innerHTML}</body></html>`)
                  printWindow.document.close()
                  setTimeout(() => {
                    printWindow.print()
                  }, 500)
                }
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print All
          </Button>
          <Button
            onClick={() => {
              if (reportRef.current) {
                const html = reportRef.current.innerHTML
                const printCSS = `
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      html, body { margin: 0; padding: 0; height: 100%; }
                      body { font-family: 'Times New Roman', serif; font-size: 12px; line-height: 1.4; background: white; }
                      @page { size: A4; margin: 5mm; }
                      .page-break { page-break-after: always; page-break-inside: avoid; }
                      .hidden { display: none; }
                      .print\\:table { display: table; }
                      img { max-width: 100%; height: auto; display: block; }
                      table { width: 100%; border-collapse: collapse; font-size: inherit; margin-bottom: 10px; }
                      th, td { border: 1px solid #333; padding: 6px; word-break: break-word; }
                      th { background-color: #ddd; font-weight: bold; }
                      tr { orphans: 2; widows: 2; }
                      svg { display: block; margin: 0 auto; max-width: 100%; }
                      .text-center { text-align: center; }
                      .text-left { text-align: left; }
                      .text-xs { font-size: 11px; }
                      .text-sm { font-size: 12px; }
                      .text-lg { font-size: 14px; }
                      .font-bold { font-weight: bold; }
                      .italic { font-style: italic; }
                      .uppercase { text-transform: uppercase; }
                      .border { border: 1px solid #333; }
                      .border-2 { border: 2px solid #333; }
                      .border-b-2 { border-bottom: 2px solid #333; }
                      .border-r-2 { border-right: 2px solid #333; }
                      .border-b { border-bottom: 1px solid #333; }
                      .border-t { border-top: 1px solid #333; }
                      .p-1 { padding: 4px; }
                      .p-2 { padding: 8px; }
                      .p-3 { padding: 12px; }
                      .p-4 { padding: 16px; }
                      .mb-1 { margin-bottom: 4px; }
                      .mb-2 { margin-bottom: 8px; }
                      .mb-3 { margin-bottom: 12px; }
                      .mb-4 { margin-bottom: 16px; }
                      .mt-1 { margin-top: 4px; }
                      .mt-2 { margin-top: 8px; }
                      .mt-0\.5 { margin-top: 2px; }
                      .gap-3 { gap: 12px; }
                      .bg-white { background-color: white; }
                      .bg-gray-50 { background-color: #f9f9f9; }
                      .bg-gray-100 { background-color: #f3f3f3; }
                      .bg-gray-200 { background-color: #e5e5e5; }
                      .bg-yellow-100 { background-color: #fef3c7; }
                      .grid { display: grid; }
                      .grid-cols-2 { grid-template-columns: 1fr 1fr; }
                      .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
                      .mx-auto { margin-left: auto; margin-right: auto; }
                      .object-contain { object-fit: contain; }
                      .text-blue-900 { color: #1e3a8a; }
                      .text-gray-700 { color: #374151; }
                      .text-gray-600 { color: #4b5563; }
                      .text-gray-500 { color: #6b7280; }
                      .tracking-widest { letter-spacing: 0.05em; }
                      .inline-block { display: inline-block; }
                      .flex { display: flex; }
                      .justify-between { justify-content: space-between; }
                      .items-center { align-items: center; }
                      .flex-col { flex-direction: column; }
                      .pb-3 { padding-bottom: 12px; }
                      .pb-1 { padding-bottom: 3px; }
                      .pb-2 { padding-bottom: 8px; }
                      .min-h-6 { min-height: 24px; }
                      .min-h-12 { min-height: 48px; }
                      .min-h-14 { min-height: 56px; }
                      .w-20 { width: 80px; }
                      .h-20 { height: 80px; }
                      .w-32 { width: 128px; }
                      .h-32 { height: 128px; }
                      .space-y-1 > * + * { margin-top: 4px; }
                      .space-y-2 > * + * { margin-top: 8px; }
                      .space-y-0\.5 > * + * { margin-top: 2px; }
                      @media print {
                        body { margin: 0; padding: 0; font-size: 12px; min-height: 100vh; }
                        * { orphans: 3; widows: 3; }
                        img { page-break-inside: avoid; }
                        table { page-break-inside: avoid; }
                      }
                    </style>
                  `
                const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8">${printCSS}</head><body>${html}</body></html>`], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `Reports_${new Date().toISOString().split('T')[0]}.html`
                a.click()
                URL.revokeObjectURL(url)
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export HTML
          </Button>
        </div>

        {/* Reports */}
        <div ref={reportRef} className="space-y-8 bg-white">
          {reports.map((report, idx) => {
            try {
              const learnerId = (report as any).learner?.id || (report as any).id
              const studentHistory = (learnerId && termHistory?.[learnerId]) || []

              const subjectData = subjects.map(subject => {
                const score = report.marks[subject.id]
                const perf = getCBCPerformanceLevel(score || 0, className)
                const remarks = getCBCRemarks(score, className)
                return { subject, score, level: perf.level, points: perf.points, remarks }
              })

              const totalPoints = subjectData.reduce((sum, s) => sum + s.points, 0)
              const maxPointsPerSubject = isUpperClass(className) ? 8 : 4
              const maxPoints = subjects.length * maxPointsPerSubject
              const meanMark = report.average
              const meanPerf = getCBCPerformanceLevel(meanMark, className)

              return (
                <div key={report.learner.id || idx} className="bg-white p-4 page-break" style={{ minHeight: '100vh', pageBreakInside: 'avoid' }}>
                  {/* School Header with Logo and Contact Info */}
                  <div className="text-center mb-4 pb-3 border-b-2 border-gray-400">
                    {/* Contact Info on Left */}
                    <div className="text-sm text-gray-700 mb-3">
                      <div style={{ fontSize: '11px' }}>PO Box XXX</div>
                      <div style={{ fontSize: '11px' }}>Tel: +254 XXX XXX XXX</div>
                      <div style={{ fontSize: '11px' }}>Email: info@school.ke</div>
                    </div>
                    
                    {/* Centered Logo - Larger */}
                    <img src="/logos/amagoro.jpeg" alt="School Logo" className="w-32 h-32 mx-auto mb-3 object-contain" />
                    
                    {/* School Name - Larger */}
                    <div className="font-bold text-lg text-blue-900 uppercase tracking-widest mb-1">{currentSchool?.name || 'AMAGORO COMPREHENSIVE SCHOOL'}</div>
                    {currentSchool?.tagline && <div className="text-sm italic text-gray-700" style={{ fontSize: '11px' }}>{currentSchool.tagline}</div>}
                  </div>

                  {/* Report Title with Exam Details */}
                  <div className="text-center mb-4">
                    <div className="border-2 border-black inline-block px-6 py-2 mb-2" style={{ fontSize: '13px' }}>
                      <div className="font-bold">PROGRESS REPORT - TERM {sessionInfo?.term || 'N/A'}, {sessionInfo?.year || 'N/A'}</div>
                    </div>
                    {sessionInfo?.exam_types?.name && (
                      <div className="font-semibold text-gray-700 mt-2" style={{ fontSize: '11px' }}>
                        {sessionInfo.exam_types.name.toUpperCase()} | TERM {sessionInfo?.term || 'N/A'} | {sessionInfo?.year || 'N/A'}
                      </div>
                    )}
                  </div>

                  {/* Student Info */}
                  <div className="grid grid-cols-3 gap-3 mb-3" style={{ fontSize: '11px' }}>
                    <div><span className="font-bold">NAME:</span> {report.learner.name}</div>
                    <div><span className="font-bold">ADMISSION NO:</span> {report.learner.admission_number || '-'}</div>
                    <div><span className="font-bold">CLASS:</span> {className}</div>
                  </div>

                  {/* Marks Table */}
                  <table className="w-full border-collapse mb-3" style={{ fontSize: '11px' }}>
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-400 p-2 text-left">SUBJECT</th>
                        <th className="border border-gray-400 p-2 text-center w-12">SCORE</th>
                        <th className="border border-gray-400 p-2 text-center w-12">LEVEL</th>
                        <th className="border border-gray-400 p-2 text-center w-10">PTS</th>
                        <th className="border border-gray-400 p-2 text-center w-14">POS</th>
                        <th className="border border-gray-400 p-2 text-left">REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectData.map((item, i) => (
                        <tr key={item.subject.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-400 p-2">{item.subject.name.toUpperCase()}</td>
                          <td className="border border-gray-400 p-2 text-center">{item.score ?? '-'}</td>
                          <td className="border border-gray-400 p-2 text-center font-bold">{item.level}</td>
                          <td className="border border-gray-400 p-2 text-center">{item.points}</td>
                          <td className="border border-gray-400 p-2 text-center">{report.subjectPositions?.[item.subject.id] || '-'}/{totalStudents}</td>
                          <td className="border border-gray-400 p-2" style={{ fontSize: '10px' }}>{item.remarks}</td>
                        </tr>
                      ))}
                      <tr className="bg-yellow-100 font-bold">
                        <td className="border border-gray-400 p-2">TOTAL</td>
                        <td className="border border-gray-400 p-2 text-center">{report.total}</td>
                        <td className="border border-gray-400 p-2 text-center"></td>
                        <td className="border border-gray-400 p-2 text-center">{totalPoints}</td>
                        <td className="border border-gray-400 p-2 text-center"></td>
                        <td className="border border-gray-400 p-2"></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Summary - Mean Marks and Performance Level */}
                  <div className="grid grid-cols-2 gap-3 mb-3" style={{ fontSize: '11px' }}>
                    <div className="border border-gray-400 p-3">
                      <div><strong>MEAN MARKS:</strong> {meanMark.toFixed(1)}</div>
                      <div className="mt-1"><strong>LEVEL:</strong> {meanPerf.level}</div>
                    </div>
                    <div className="border border-gray-400 p-3">
                      <div><strong>TOTAL POINTS:</strong> {totalPoints}/{maxPoints}</div>
                      <div className="mt-1"><strong>POSITION:</strong> {report.rank}/{totalStudents}</div>
                    </div>
                  </div>

                  {/* Historical Performance Table - Hide on print to save space */}
                  {studentHistory && studentHistory.length > 0 && (
                    <table className="w-full border-collapse mb-2 text-xs hidden print:table" style={{ fontSize: '8px' }}>
                      <thead>
                        <tr className="bg-gray-200 border-2 border-gray-400">
                          <th className="border border-gray-400 p-1 text-left font-bold">TERM</th>
                          <th className="border border-gray-400 p-1 text-center font-bold">SCORE</th>
                          <th className="border border-gray-400 p-1 text-center font-bold">AVG</th>
                          <th className="border border-gray-400 p-1 text-center font-bold">POS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentHistory.map((history, i) => (
                          <tr key={i} className="border-b border-gray-400 text-center">
                            <td className="border border-gray-400 p-1 text-left font-semibold">T{history.term}</td>
                            <td className="border border-gray-400 p-1">{history.total || '-'}</td>
                            <td className="border border-gray-400 p-1">{history.average ? history.average.toFixed(1) : '-'}</td>
                            <td className="border border-gray-400 p-1">{history.rank || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Subject Distribution and Performance Trend - Bordered Container */}
                  <div className="border-2 border-gray-400 mb-3 grid grid-cols-2" style={{ fontSize: '11px' }}>
                    {/* Subject Distribution Pie Chart */}
                    <div className="border-r-2 border-gray-400 p-3 flex flex-col items-center">
                      <div className="font-bold mb-2 text-center">SUBJECT DISTRIBUTION</div>
                      <svg viewBox="0 0 120 120" className="w-full" style={{ height: '110px' }}>
                        {(() => {
                          const scores = subjectData.map(s => s.score || 0)
                          const total = scores.reduce((a, b) => a + b, 0)
                          if (total === 0) return null
                          
                          const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']
                          
                          let currentAngle = 0
                          return scores.map((score, i) => {
                            if (score === 0) return null
                            const sliceAngle = (score / total) * 360
                            const startAngle = currentAngle
                            const endAngle = currentAngle + sliceAngle
                            
                            const startRad = (startAngle * Math.PI) / 180
                            const endRad = (endAngle * Math.PI) / 180
                            
                            const x1 = 60 + 38 * Math.cos(startRad)
                            const y1 = 60 + 38 * Math.sin(startRad)
                            const x2 = 60 + 38 * Math.cos(endRad)
                            const y2 = 60 + 38 * Math.sin(endRad)
                            
                            const largeArc = sliceAngle > 180 ? 1 : 0
                            const path = `M 60 60 L ${x1} ${y1} A 38 38 0 ${largeArc} 1 ${x2} ${y2} Z`
                            
                            currentAngle = endAngle
                            
                            return <path key={i} d={path} fill={colors[i % colors.length]} stroke="white" strokeWidth="1" />
                          })
                        })()}
                      </svg>
                    </div>

                    {/* Performance Trend Line Graph */}
                    <div className="p-3 flex flex-col items-center">
                      <div className="font-bold mb-2 text-center">PERFORMANCE TREND</div>
                      {studentHistory && studentHistory.length > 0 ? (
                        <svg viewBox="0 0 140 100" className="w-full" style={{ height: '110px' }}>
                          <line x1="20" y1="10" x2="20" y2="85" stroke="#999" strokeWidth="0.5" />
                          <line x1="20" y1="85" x2="135" y2="85" stroke="#999" strokeWidth="0.5" />
                          <text x="16" y="15" fontSize="3" textAnchor="end">100</text>
                          <text x="16" y="50" fontSize="3" textAnchor="end">50</text>
                          <text x="16" y="87" fontSize="3" textAnchor="end">0</text>
                          {studentHistory.map((history, i) => {
                            const x = 25 + (i * (110 / Math.max(studentHistory.length - 1, 1)))
                            const y = 85 - ((history.average / 100) * 75)
                            const nextHistory = studentHistory[i + 1]
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="1.2" fill="#1e40af" />
                                {nextHistory && (
                                  <line
                                    x1={x}
                                    y1={y}
                                    x2={25 + ((i + 1) * (110 / Math.max(studentHistory.length - 1, 1)))}
                                    y2={85 - ((nextHistory.average / 100) * 75)}
                                    stroke="#1e40af"
                                    strokeWidth="1.5"
                                  />
                                )}
                              </g>
                            )
                          })}
                        </svg>
                      ) : (
                        <div style={{ height: '110px' }} className="flex items-center justify-center text-gray-500">No trend data</div>
                      )}
                    </div>
                  </div>

                    {/* Performance Trend Line Graph */}
                    <div className="p-2 flex flex-col items-center">
                      <div className="font-bold mb-1 text-center">PERFORMANCE TREND</div>
                      {studentHistory && studentHistory.length > 0 ? (
                        <svg viewBox="0 0 140 100" className="w-full" style={{ height: '70px' }}>
                          <line x1="20" y1="10" x2="20" y2="85" stroke="#999" strokeWidth="0.5" />
                          <line x1="20" y1="85" x2="135" y2="85" stroke="#999" strokeWidth="0.5" />
                          <text x="16" y="15" fontSize="3" textAnchor="end">100</text>
                          <text x="16" y="50" fontSize="3" textAnchor="end">50</text>
                          <text x="16" y="87" fontSize="3" textAnchor="end">0</text>
                          {studentHistory.map((history, i) => {
                            const x = 25 + (i * (110 / Math.max(studentHistory.length - 1, 1)))
                            const y = 85 - ((history.average / 100) * 75)
                            const nextHistory = studentHistory[i + 1]
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="1.2" fill="#1e40af" />
                                {nextHistory && (
                                  <line
                                    x1={x}
                                    y1={y}
                                    x2={25 + ((i + 1) * (110 / Math.max(studentHistory.length - 1, 1)))}
                                    y2={85 - ((nextHistory.average / 100) * 75)}
                                    stroke="#1e40af"
                                    strokeWidth="1.5"
                                  />
                                )}
                              </g>
                            )
                          })}
                        </svg>
                      ) : (
                        <div className="text-xs text-gray-500 flex items-center justify-center" style={{ height: '70px' }}>No trend data</div>
                      )}
                    </div>
                  </div>

                  {/* Remarks Sections - Larger */}
                  <div className="space-y-2 text-xs mb-2" style={{ fontSize: '10px' }}>
                    {/* Class Teacher Remarks */}
                    <div className="border-2 border-gray-400">
                      <div className="bg-gray-200 font-bold p-2 border-b border-gray-400">CLASS TEACHER'S REMARKS:</div>
                      <div className="p-2 min-h-12"></div>
                      <div className="flex justify-between px-2 pb-2 border-t border-gray-400" style={{ fontSize: '10px' }}>
                        <div>NAME: __________ SIGN: __________</div>
                        <div>DATE: __________</div>
                      </div>
                    </div>

                    {/* Head Teacher Remarks */}
                    <div className="border-2 border-gray-400">
                      <div className="bg-gray-200 font-bold p-2 border-b border-gray-400">HEAD TEACHER'S REMARKS:</div>
                      <div className="p-2 min-h-12"></div>
                      <div className="flex justify-between px-2 pb-2 border-t border-gray-400" style={{ fontSize: '10px' }}>
                        <div>SIGN: __________</div>
                        <div>DATE: __________</div>
                        <div>STAMP:</div>
                      </div>
                    </div>

                    {/* Parent/Guardian Remarks */}
                    <div className="border-2 border-gray-400">
                      <div className="bg-gray-200 font-bold p-2 border-b border-gray-400">PARENT/GUARDIAN'S REMARKS:</div>
                      <div className="p-2 min-h-12"></div>
                      <div className="flex justify-between px-2 pb-2 border-t border-gray-400" style={{ fontSize: '10px' }}>
                        <div>NAME: __________</div>
                        <div>SIGN: __________</div>
                        <div>DATE: __________</div>
                      </div>
                    </div>
                  </div>

                  {/* CBE Performance Levels Guide */}
                  <div className="border-2 border-gray-400 p-2 mb-2" style={{ fontSize: '10px' }}>
                    <div className="font-bold mb-1">CBE PERFORMANCE LEVELS:</div>
                    <div style={{ fontSize: '10px' }} className="space-y-0.5">
                      <div><strong>EE</strong>=Exceeding Exp-4pts | <strong>ME</strong>=Meeting Exp-3pts | <strong>PE</strong>=Partially Exp-2pts | <strong>BE</strong>=Below Exp-1pt</div>
                    </div>
                  </div>

                  {/* Next Term Info */}
                  <div className="border-2 border-gray-400 p-2" style={{ fontSize: '10px' }}>
                    <div className="font-bold">NEXT TERM BUSES FROM: __________ TO: __________</div>
                  </div>
                </div>
              )
            } catch (err) {
              console.error('[v0] Error rendering report:', err)
              return <div key={idx} className="text-red-500 p-4">Error rendering report for {report.learner.name}</div>
            }
          })}
        </div>
      </div>
    </div>
  )
}
