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

// CBC Performance Level helper - returns level and points based on class
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
  if (score === null) return ''
  const perf = getCBCPerformanceLevel(score, className)
  if (perf.level.startsWith('EE')) return 'EXCELLENT WORK'
  if (perf.level.startsWith('ME')) return 'GOOD PROGRESS'
  if (perf.level.startsWith('AE')) return 'NEEDS IMPROVEMENT'
  if (perf.level.startsWith('BE')) return 'MORE EFFORT NEEDED'
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
  classTeacherName = null
}: ReportStareheStyleProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const { currentSchool } = useSchool()

  if (!isOpen) return null

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      alert('Please allow pop-ups to print reports')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Report Cards - ${currentSchool?.name || 'School'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; background: #fff; font-size: 11px; }
          .report-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 8mm 10mm;
            page-break-after: always;
            position: relative;
          }
          .report-page:last-child { page-break-after: auto; }
          .header { text-align: center; margin-bottom: 8px; }
          .header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
          .school-info { text-align: left; font-size: 9px; line-height: 1.3; flex: 1; }
          .school-logo { width: 70px; height: 70px; object-fit: contain; }
          .school-title { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; margin-bottom: 3px; }
          .school-motto { font-size: 10px; font-style: italic; margin-bottom: 5px; }
          .report-title { font-size: 12px; font-weight: bold; border: 1px solid #000; display: inline-block; padding: 3px 15px; }
          .student-row { display: flex; gap: 20px; margin: 8px 0; font-size: 11px; }
          .student-row span { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
          th { background: #e5e7eb; font-weight: bold; font-size: 10px; }
          td { font-size: 10px; }
          .subject-name { text-align: left; font-weight: 500; }
          .highlight-row { background: #dcfce7; }
          .total-row { background: #fef3c7; font-weight: bold; }
          .summary-section { margin: 10px 0; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .legend { font-size: 9px; text-align: right; }
          .term-table th { font-size: 9px; }
          .term-table td { font-size: 9px; }
          .trend-section { margin: 10px 0; }
          .trend-graph { border: 1px solid #333; height: 100px; padding: 5px; position: relative; }
          .trend-title { font-size: 10px; font-weight: bold; margin-bottom: 5px; }
          .comments-section { margin: 10px 0; }
          .comment-box { border: 1px solid #333; padding: 8px; margin-bottom: 8px; min-height: 50px; }
          .comment-label { font-weight: bold; font-size: 10px; margin-bottom: 5px; }
          .sign-row { display: flex; justify-content: space-between; margin-top: 5px; font-size: 9px; }
          .footer-section { margin-top: 10px; font-size: 9px; }
          .next-term { font-weight: bold; margin-top: 8px; }
          svg { width: 100%; height: 80px; }
          @page { size: A4; margin: 5mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `)
    
    printWindow.document.close()
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold">
            CBC Report Cards ({reports.length} student{reports.length !== 1 ? 's' : ''})
          </h2>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div ref={printRef}>
            {reports.map((report, idx) => {
              // Calculate subject-wise data using CBC performance levels
              const subjectData = subjects.map(subject => {
                const score = report.marks[subject.id]
                const perf = score !== null ? getCBCPerformanceLevel(score, className) : { level: '-', points: 0 }
                const remarks = getCBCRemarks(score, className)
                return { subject, score, level: perf.level, points: perf.points, remarks }
              })

              const totalPoints = subjectData.reduce((sum, s) => sum + s.points, 0)
              // Max points depends on class level (4 per subject for lower, 8 for upper)
              const maxPointsPerSubject = isUpperClass(className) ? 8 : 4
              const maxPoints = subjects.length * maxPointsPerSubject
              const meanMark = report.average
              const meanPerf = getCBCPerformanceLevel(meanMark, className)

              // Get term history for this student
              const studentHistory = termHistory[report.learner.id] || []

              // Generate trend data for graph
              const trendData = subjectData.map((s, i) => ({
                x: i,
                y: s.score !== null ? s.score : 50
              }))

              return (
                <div
                  key={report.learner.id}
                  className="report-page bg-white shadow-lg mb-6 mx-auto"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '8mm 10mm',
                    fontFamily: "'Times New Roman', serif",
                    fontSize: '11px'
                  }}
                >
                  {/* Header */}
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    {/* Centered Logo */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <img 
                        src={currentSchool?.logo_url || `/logos/${currentSchool?.code}.jpeg`}
                        alt="School Logo"
                        style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ textAlign: 'left', fontSize: '9px', lineHeight: 1.3, flex: 1 }}>
                        <div>{currentSchool?.address || 'P.O. Box XXX'}</div>
                        <div>{currentSchool?.phone || 'Tel: +254 XXX XXX XXX'}</div>
                        <div>{currentSchool?.email || 'Email: info@school.ac.ke'}</div>
                      </div>
                      <div style={{ textAlign: 'center', flex: 2 }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e3a8a' }}>
                          {currentSchool?.name || 'School Name'}
                        </div>
                        {currentSchool?.tagline && (
                          <div style={{ fontSize: '10px', fontStyle: 'italic' }}>{currentSchool.tagline}</div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', border: '1px solid #000', display: 'inline-block', padding: '3px 15px', marginTop: '5px' }}>
                      PROGRESS REPORT - TERM {sessionInfo?.term}, {sessionInfo?.year}
                    </div>
                  </div>

                  {/* Student Info Row */}
                  <div style={{ display: 'flex', gap: '20px', margin: '8px 0', fontSize: '11px' }}>
                    <div><span style={{ fontWeight: 'bold' }}>NAME:</span> {report.learner.name}</div>
                    <div><span style={{ fontWeight: 'bold' }}>ASSESSMENT NO:</span> {report.learner.admission_number || '-'}</div>
                    <div><span style={{ fontWeight: 'bold' }}>CLASS:</span> {className}</div>
                  </div>

                  {/* Main Subject Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                    <thead>
                      <tr style={{ background: '#e5e7eb' }}>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'left', fontSize: '10px' }}>SUBJECT</th>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', width: '50px' }}>SCORE<br/>/100</th>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', width: '40px' }}>LEVEL</th>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', width: '35px' }}>PTS</th>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', width: '60px' }}>CLASS<br/>POS</th>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', minWidth: '120px' }}>REMARKS</th>
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', width: '50px' }}>INITIALS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectData.map((item, i) => (
                        <tr key={item.subject.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'left', fontWeight: 500, fontSize: '10px' }}>
                            {item.subject.name.toUpperCase()}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>
                            {item.score ?? '-'}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                            {item.level}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>
                            {item.points}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>
                            {report.subjectPositions?.[item.subject.id] || '-'}/{totalStudents}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'left', fontSize: '9px' }}>
                            {item.remarks}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>
                            
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr style={{ background: '#fef3c7', fontWeight: 'bold' }}>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'left', fontSize: '10px' }}>TOTAL</td>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>{report.total}</td>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>{totalPoints}</td>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px' }}></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Summary Section - CBC Format */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px' }}>
                    <div>
                      <div><strong>MEAN MARK:</strong> {meanMark.toFixed(1)}</div>
                      <div><strong>PERFORMANCE LEVEL:</strong> {meanPerf.level} ({getCBCLevelDescription(meanPerf.level)})</div>
                    </div>
                    <div>
                      <div><strong>TOTAL POINTS:</strong> {totalPoints}/{maxPoints}</div>
                      <div><strong>OVERALL POSITION:</strong> {report.rank} OF {totalStudents}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '8px', color: '#666' }}>
                      <div>EE - Exceeding Expectation</div>
                      <div>ME - Meeting Expectation</div>
                      <div>AE - Approaching Expectation</div>
                      <div>BE - Below Expectation</div>
                    </div>
                  </div>

                  {/* Term Comparison Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9px' }}>
                    <thead>
                      <tr style={{ background: '#e5e7eb' }}>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}></th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>TOTAL<br/>SCORE</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>AVERAGE<br/>POINTS</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>IMPR.<br/>(+/-)</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>TOTAL<br/>POINTS</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>MEAN<br/>MARK</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>PERF.<br/>LEVEL</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>STREAM<br/>POS</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>OVERALL<br/>POS</th>
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>DAYS<br/>ABSENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map(term => {
                        const termData = studentHistory.find(h => h.term === term)
                        const isCurrent = term === sessionInfo?.term
                        return (
                          <tr key={term} style={{ background: isCurrent ? '#dcfce7' : '#fff' }}>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', fontWeight: 'bold' }}>TERM {term}</td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? `${report.total}/${subjects.length * 100}` : (termData ? `${termData.total}/${subjects.length * 100}` : '-')}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? (totalPoints / subjects.length).toFixed(2) : (termData ? (termData.average).toFixed(2) : '-')}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>-</td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? `${totalPoints}/${maxPoints}` : (termData ? termData.total : '-')}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? meanMark.toFixed(2) : (termData ? termData.average.toFixed(2) : '-')}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? meanPerf.level : (termData ? getCBCPerformanceLevel(termData.average, className).level : '-')}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? (report.streamRank ? `${report.streamRank}/${report.streamTotal}` : '-') : '-'}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>
                              {isCurrent ? `${report.rank}/${totalStudents}` : (termData ? `${termData.rank}` : '-')}
                            </td>
                            <td style={{ border: '1px solid #333', padding: '3px 4px', textAlign: 'center' }}>-</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Graphs and Comments Section */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {/* Grade Distribution Pie Chart */}
                    <div style={{ flex: 1, border: '1px solid #333', padding: '5px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '3px', textAlign: 'center' }}>GRADE DISTRIBUTION</div>
                      <svg viewBox="0 0 120 80" style={{ width: '100%', height: '70px' }}>
                        {(() => {
                          // Count grades/levels for pie chart
                          const gradeCounts: Record<string, number> = {}
                          subjectData.forEach(item => {
                            const level = item.level.replace(/[0-9]/g, '') // EE, ME, AE, BE
                            if (level && level !== '-') {
                              gradeCounts[level] = (gradeCounts[level] || 0) + 1
                            }
                          })
                          
                          const gradeColors: Record<string, string> = {
                            'EE': '#059669', // Green - Exceeding
                            'ME': '#1e40af', // Blue - Meeting
                            'AE': '#d97706', // Orange - Approaching
                            'BE': '#dc2626'  // Red - Below
                          }
                          const gradeOrder = ['EE', 'ME', 'AE', 'BE']
                          const grades = gradeOrder.filter(g => gradeCounts[g])
                          const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0)
                          
                          let startAngle = 0
                          const cx = 35, cy = 40, r = 28
                          
                          const slices = grades.map((grade, i) => {
                            const count = gradeCounts[grade] || 0
                            const percentage = total > 0 ? (count / total) * 100 : 0
                            const sliceAngle = total > 0 ? (count / total) * 2 * Math.PI : 0
                            const endAngle = startAngle + sliceAngle
                            
                            const x1 = cx + r * Math.cos(startAngle - Math.PI / 2)
                            const y1 = cy + r * Math.sin(startAngle - Math.PI / 2)
                            const x2 = cx + r * Math.cos(endAngle - Math.PI / 2)
                            const y2 = cy + r * Math.sin(endAngle - Math.PI / 2)
                            
                            // Label position
                            const midAngle = startAngle + sliceAngle / 2 - Math.PI / 2
                            const labelX = cx + (r * 0.6) * Math.cos(midAngle)
                            const labelY = cy + (r * 0.6) * Math.sin(midAngle)
                            
                            const largeArc = sliceAngle > Math.PI ? 1 : 0
                            const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
                            
                            startAngle = endAngle
                            
                            return (
                              <g key={grade}>
                                <path d={pathData} fill={gradeColors[grade]} stroke="#fff" strokeWidth="0.5" />
                                {percentage >= 10 && (
                                  <text x={labelX} y={labelY} fontSize="5" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
                                    {percentage.toFixed(0)}%
                                  </text>
                                )}
                              </g>
                            )
                          })
                          
                          return slices
                        })()}
                        {/* Legend with percentages */}
                        {(() => {
                          const gradeCounts: Record<string, number> = {}
                          subjectData.forEach(item => {
                            const level = item.level.replace(/[0-9]/g, '')
                            if (level && level !== '-') {
                              gradeCounts[level] = (gradeCounts[level] || 0) + 1
                            }
                          })
                          const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0)
                          const gradeColors: Record<string, string> = { 'EE': '#059669', 'ME': '#1e40af', 'AE': '#d97706', 'BE': '#dc2626' }
                          const gradeLabels: Record<string, string> = { 'EE': 'Exceeding', 'ME': 'Meeting', 'AE': 'Approaching', 'BE': 'Below' }
                          const gradeOrder = ['EE', 'ME', 'AE', 'BE']
                          
                          return gradeOrder.filter(g => gradeCounts[g]).map((grade, i) => {
                            const count = gradeCounts[grade] || 0
                            const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0'
                            return (
                              <g key={`legend-${grade}`}>
                                <rect x="70" y={8 + i * 14} width="8" height="8" fill={gradeColors[grade]} rx="1" />
                                <text x="80" y={14 + i * 14} fontSize="5" fill="#333">{gradeLabels[grade]} ({pct}%)</text>
                              </g>
                            )
                          })
                        })()}
                      </svg>
                    </div>

                    {/* Trend Graph - Only show if there's historical data */}
                    {studentHistory && studentHistory.length > 0 && (
                    <div style={{ flex: 1, border: '1px solid #333', padding: '5px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '3px', textAlign: 'center' }}>PERFORMANCE TREND</div>
                      <svg viewBox="0 0 200 55" style={{ width: '100%', height: '55px' }}>
                        {/* Grid lines */}
                        <line x1="20" y1="5" x2="20" y2="50" stroke="#ddd" strokeWidth="0.5" />
                        <line x1="20" y1="50" x2="195" y2="50" stroke="#ddd" strokeWidth="0.5" />
                        {/* Y-axis labels */}
                        <text x="15" y="10" fontSize="5" textAnchor="end">100</text>
                        <text x="15" y="30" fontSize="5" textAnchor="end">50</text>
                        <text x="15" y="50" fontSize="5" textAnchor="end">0</text>
                        {/* Plot points from term history */}
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
                    {(!studentHistory || studentHistory.length === 0) && (
                    <div style={{ flex: 1, border: '1px solid #333', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#999', textAlign: 'center' }}>No historical data available</div>
                    </div>
                    )}
                  </div>

                  {/* Class Teacher Comments */}
                  <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px' }}>CLASS TEACHER&apos;S REMARKS:</div>
                    <div style={{ borderBottom: '1px dotted #999', height: '20px', marginTop: '3px' }}></div>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '9px', marginTop: '5px' }}>
                      <div><strong>NAME:</strong> {classTeacherName || '____________'}</div>
                      <div><strong>SIGN:</strong> ____________</div>
                      <div><strong>DATE:</strong> ____________</div>
                    </div>
                  </div>

                  {/* Head Teacher Remarks - CBC Primary School */}
                  <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px' }}>HEAD TEACHER&apos;S REMARKS:</div>
                    <div style={{ borderBottom: '1px dotted #999', height: '20px', marginTop: '3px' }}></div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '9px', marginTop: '5px' }}>
                      <div><strong>SIGN:</strong> ____________</div>
                      <div><strong>DATE:</strong> ____________</div>
                      <div><strong>STAMP:</strong></div>
                    </div>
                  </div>

                  {/* Parent/Guardian Section */}
                  <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px' }}>PARENT/GUARDIAN&apos;S REMARKS:</div>
                    <div style={{ borderBottom: '1px dotted #999', height: '20px', marginTop: '3px' }}></div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '9px', marginTop: '5px' }}>
                      <div><strong>NAME:</strong> ____________</div>
                      <div><strong>SIGN:</strong> ____________</div>
                      <div><strong>DATE:</strong> ____________</div>
                    </div>
                  </div>

                  {/* CBC Grading Key */}
                  <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '8px', fontSize: '8px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>CBC PERFORMANCE LEVELS:</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      {isUpperClass(className) ? (
                        <>
                          <span><strong>EE1</strong> (90-100) - 8pts</span>
                          <span><strong>EE2</strong> (75-89) - 7pts</span>
                          <span><strong>ME1</strong> (58-74) - 6pts</span>
                          <span><strong>ME2</strong> (41-57) - 5pts</span>
                          <span><strong>AE1</strong> (31-40) - 4pts</span>
                          <span><strong>AE3</strong> (21-30) - 3pts</span>
                          <span><strong>BE1</strong> (11-20) - 2pts</span>
                          <span><strong>BE2</strong> (0-10) - 1pt</span>
                        </>
                      ) : (
                        <>
                          <span><strong>EE</strong> (75-100) - Exceeding Expectation - 4pts</span>
                          <span><strong>ME</strong> (50-74) - Meeting Expectation - 3pts</span>
                          <span><strong>AE</strong> (25-49) - Approaching Expectation - 2pts</span>
                          <span><strong>BE</strong> (0-24) - Below Expectation - 1pt</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Next Term Dates */}
                  <div style={{ fontSize: '9px', fontWeight: 'bold', textAlign: 'center' }}>
                    NEXT TERM RUNS FROM: ____________ TO: ____________
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
