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
                const printWindow = window.open('', '', 'width=900,height=600')
                if (printWindow) {
                  printWindow.document.write(reportRef.current.innerHTML)
                  printWindow.document.close()
                  setTimeout(() => printWindow.print(), 250)
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
                const blob = new Blob([`<!DOCTYPE html><html><head><style>body{font-family:'Times New Roman',serif}</style></head><body>${html}</body></html>`], { type: 'text/html' })
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
        <div ref={reportRef} className="max-h-[70vh] overflow-y-auto p-6 space-y-8">
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
                <div key={report.learner.id || idx} className="bg-white p-8 rounded-lg border-2 border-gray-200 page-break">
                  {/* School Info */}
                  <div className="text-center mb-6">
                    {currentSchool?.logo_url && (
                      <img src={currentSchool.logo_url} alt="School Logo" className="w-20 h-20 mx-auto mb-3 object-contain" />
                    )}
                    <div className="font-bold text-lg text-blue-900 uppercase">{currentSchool?.name}</div>
                    {currentSchool?.tagline && <div className="text-sm italic">{currentSchool.tagline}</div>}
                    <div className="text-xs text-gray-600 mt-2">{currentSchool?.address || ''}</div>
                    <div className="text-xs text-gray-600">{currentSchool?.phone || ''}</div>
                  </div>

                  {/* Report Title */}
                  <div className="text-center border-2 border-black inline-block mx-auto block mb-4 px-4 py-2">
                    <div className="font-bold">PROGRESS REPORT - TERM {sessionInfo?.term}, {sessionInfo?.year}</div>
                  </div>

                  {/* Student Info */}
                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div><span className="font-bold">NAME:</span> {report.learner.name}</div>
                    <div><span className="font-bold">ADMISSION NO:</span> {report.learner.admission_number || '-'}</div>
                    <div><span className="font-bold">CLASS:</span> {className}</div>
                  </div>

                  {/* Marks Table */}
                  <table className="w-full border-collapse mb-4 text-xs">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-400 p-2 text-left">SUBJECT</th>
                        <th className="border border-gray-400 p-2 text-center w-12">SCORE</th>
                        <th className="border border-gray-400 p-2 text-center w-12">LEVEL</th>
                        <th className="border border-gray-400 p-2 text-center w-10">PTS</th>
                        <th className="border border-gray-400 p-2 text-center">POS</th>
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
                          <td className="border border-gray-400 p-2 text-xs">{item.remarks}</td>
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

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
                    <div>
                      <div><strong>MEAN MARK:</strong> {meanMark.toFixed(1)}</div>
                      <div><strong>LEVEL:</strong> {meanPerf.level} ({getCBCLevelDescription(meanPerf.level)})</div>
                    </div>
                    <div>
                      <div><strong>TOTAL POINTS:</strong> {totalPoints}/{maxPoints}</div>
                      <div><strong>POSITION:</strong> {report.rank} OF {totalStudents}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div>EE - Exceeding Expectation</div>
                      <div>ME - Meeting Expectation</div>
                      <div>AE - Approaching Expectation</div>
                      <div>BE - Below Expectation</div>
                    </div>
                  </div>

                  {/* Trend Graph - Only show with history */}
                  {studentHistory && studentHistory.length > 0 && (
                    <div className="border border-gray-400 p-3 mb-4">
                      <div className="text-xs font-bold mb-2 text-center">PERFORMANCE TREND</div>
                      <svg viewBox="0 0 200 55" className="w-full" style={{ height: '60px' }}>
                        <line x1="20" y1="5" x2="20" y2="50" stroke="#ddd" strokeWidth="0.5" />
                        <line x1="20" y1="50" x2="195" y2="50" stroke="#ddd" strokeWidth="0.5" />
                        <text x="15" y="10" fontSize="5" textAnchor="end">100</text>
                        <text x="15" y="30" fontSize="5" textAnchor="end">50</text>
                        <text x="15" y="50" fontSize="5" textAnchor="end">0</text>
                        {studentHistory.map((history, i) => {
                          const x = 25 + (i * (170 / Math.max(studentHistory.length - 1, 1)))
                          const y = 50 - ((history.average / 100) * 45)
                          const nextHistory = studentHistory[i + 1]
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="2" fill="#1e40af" />
                              {nextHistory && (
                                <line
                                  x1={x}
                                  y1={y}
                                  x2={25 + ((i + 1) * (170 / Math.max(studentHistory.length - 1, 1)))}
                                  y2={50 - ((nextHistory.average / 100) * 45)}
                                  stroke="#1e40af"
                                  strokeWidth="1"
                                />
                              )}
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  )}
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
