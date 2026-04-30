'use client'

import { useSchool } from '@/lib/school-context'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Printer, Download } from 'lucide-react'

interface StudentReport {
  learner: { id: string; name: string; admission_number: string | null; gender?: string }
  marks: Record<string, number | null>
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
}

// Helper function to get grade from percentage
function getGrade(score: number): string {
  if (score >= 80) return 'A'
  if (score >= 70) return 'B+'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C+'
  if (score >= 40) return 'C'
  if (score >= 30) return 'D'
  return 'E'
}

// Helper function to get points from grade
function getPoints(grade: string): number {
  const pointsMap: Record<string, number> = { 'A': 12, 'B+': 10, 'B': 8, 'C+': 6, 'C': 4, 'D': 2, 'E': 1 }
  return pointsMap[grade] || 0
}

// Helper function to get remarks based on score
function getRemarks(score: number | null): string {
  if (score === null) return ''
  if (score >= 80) return 'EXCELLENT'
  if (score >= 70) return 'VERY GOOD'
  if (score >= 60) return 'GOOD'
  if (score >= 50) return 'FAIR'
  if (score >= 40) return 'WORK HARDER'
  return 'PUT MORE EFFORT'
}

export function ReportStareheStyle({
  isOpen,
  onClose,
  reports,
  subjects,
  sessionInfo,
  className,
  totalStudents,
  termHistory = {}
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
            Report Cards - Starehe Style ({reports.length} student{reports.length !== 1 ? 's' : ''})
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
              // Calculate subject-wise data
              const subjectData = subjects.map(subject => {
                const score = report.marks[subject.id]
                const grade = score !== null ? getGrade(score) : '-'
                const points = score !== null ? getPoints(grade) : 0
                const remarks = getRemarks(score)
                return { subject, score, grade, points, remarks }
              })

              const totalPoints = subjectData.reduce((sum, s) => sum + s.points, 0)
              const maxPoints = subjects.length * 12
              const meanMark = report.average
              const meanGrade = getGrade(meanMark)

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ textAlign: 'left', fontSize: '9px', lineHeight: 1.3, flex: 1 }}>
                        <div>{currentSchool?.address || 'P.O. Box XXX'}</div>
                        <div>{currentSchool?.phone || 'Tel: +254 XXX XXX XXX'}</div>
                        <div>{currentSchool?.email || 'Email: info@school.ac.ke'}</div>
                      </div>
                      <div style={{ textAlign: 'center', flex: 2 }}>
                        <img 
                          src={currentSchool?.logo_url || `/logos/${currentSchool?.code}.jpeg`}
                          alt="School Logo"
                          style={{ width: '70px', height: '70px', objectFit: 'contain', marginBottom: '5px' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
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
                        <th style={{ border: '1px solid #333', padding: '4px 6px', fontSize: '10px', width: '40px' }}>GRD</th>
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
                            {item.grade}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>
                            {item.points}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontSize: '10px' }}>
                            {report.rank}/{totalStudents}
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

                  {/* Summary Section */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px' }}>
                    <div>
                      <div><strong>MEAN MARK:</strong> {meanMark.toFixed(1)}</div>
                      <div><strong>MEAN GRADE:</strong> {meanGrade}</div>
                    </div>
                    <div>
                      <div><strong>TOTAL POINTS:</strong> {totalPoints}/{maxPoints}</div>
                      <div><strong>OVERALL POSITION:</strong> {report.rank} OF {totalStudents}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '8px', color: '#666' }}>
                      <div>X - MISSING SCORE</div>
                      <div>Y - IRREGULARITY</div>
                      <div>Z - NOT GRADED</div>
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
                        <th style={{ border: '1px solid #333', padding: '3px 4px' }}>MEAN<br/>GRADE</th>
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
                              {isCurrent ? meanGrade : (termData ? getGrade(termData.average) : '-')}
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

                  {/* Trend Graph and Comments Section */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                    {/* Trend Graph */}
                    <div style={{ flex: 1, border: '1px solid #333', padding: '5px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '5px' }}>TREND</div>
                      <svg viewBox="0 0 200 60" style={{ width: '100%', height: '60px' }}>
                        {/* Grid lines */}
                        <line x1="20" y1="5" x2="20" y2="55" stroke="#ddd" strokeWidth="0.5" />
                        <line x1="20" y1="55" x2="195" y2="55" stroke="#ddd" strokeWidth="0.5" />
                        {/* Y-axis labels */}
                        <text x="15" y="10" fontSize="5" textAnchor="end">100</text>
                        <text x="15" y="30" fontSize="5" textAnchor="end">50</text>
                        <text x="15" y="55" fontSize="5" textAnchor="end">0</text>
                        {/* Plot points and lines */}
                        {trendData.map((point, i) => {
                          const x = 25 + (i * (170 / Math.max(trendData.length - 1, 1)))
                          const y = 55 - ((point.y / 100) * 50)
                          const nextPoint = trendData[i + 1]
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="2" fill="#1e40af" />
                              {nextPoint && (
                                <line
                                  x1={x}
                                  y1={y}
                                  x2={25 + ((i + 1) * (170 / Math.max(trendData.length - 1, 1)))}
                                  y2={55 - ((nextPoint.y / 100) * 50)}
                                  stroke="#1e40af"
                                  strokeWidth="1"
                                />
                              )}
                            </g>
                          )
                        })}
                      </svg>
                    </div>

                    {/* Comments */}
                    <div style={{ flex: 1.5 }}>
                      <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '5px', minHeight: '40px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '9px' }}>CLASS TEACHER&apos;S REMARKS:</div>
                        <div style={{ borderBottom: '1px dotted #999', height: '20px', marginTop: '3px' }}></div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '9px' }}>
                        <div><strong>SIGN:</strong> ____________</div>
                        <div><strong>DATE:</strong> ____________</div>
                      </div>
                    </div>
                  </div>

                  {/* Senior Master / Head Teacher */}
                  <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px' }}>HEAD TEACHER / SENIOR MASTER:</div>
                    <div style={{ borderBottom: '1px dotted #999', height: '20px', marginTop: '3px' }}></div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '9px', marginTop: '5px' }}>
                      <div><strong>SIGN:</strong> ____________</div>
                      <div><strong>DATE:</strong> ____________</div>
                    </div>
                  </div>

                  {/* Director/Principal Remarks */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px' }}>REMARKS BY DIRECTOR/PRINCIPAL:</div>
                    <div style={{ borderBottom: '1px solid #333', height: '25px', marginTop: '3px' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '5px' }}>
                      <div><strong>SIGN:</strong> ____________</div>
                      <div><strong>DATE:</strong> ____________</div>
                    </div>
                  </div>

                  {/* Report Seen By */}
                  <div style={{ border: '1px solid #333', padding: '5px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px' }}>REPORT SEEN BY:</div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '9px', marginTop: '5px' }}>
                      <div><strong>SIGN:</strong> ____________</div>
                      <div><strong>DATE:</strong> ____________</div>
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
