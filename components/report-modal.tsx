'use client'

import { Button } from '@/components/ui/button'
import { useSchool } from '@/lib/school-context'
import { X, Printer, Download } from 'lucide-react'
import { useRef } from 'react'

interface StudentReport {
  learner: { id: string; name: string; admission_number: string | null }
  marks: Record<string, number | null>
  total: number
  rank: number
  average: number
  overall_rank?: number
  total_in_grade?: number
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

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  reports: StudentReport[]
  subjects: Subject[]
  sessionInfo: SessionInfo | null
  className: string
  totalStudents: number
}

export function ReportModal({
  isOpen,
  onClose,
  reports,
  subjects,
  sessionInfo,
  className,
  totalStudents
}: ReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const { currentSchool } = useSchool()

  if (!isOpen) return null

  const handlePrint = () => {
    // Store report data in sessionStorage (temporary storage)
    const reportData = {
      school: currentSchool,
      className: className,
      examType: examType,
      results: reportModalData,
      termHistory: termHistory,
      subjects: subjects,
      term: term
    }
    
    sessionStorage.setItem('printReportData', JSON.stringify(reportData))
    
    // Open print page in new tab without blocking main window
    window.open('/print-report', '_blank')
  }

  const handleDownloadPDF = () => {
    // For PDF download, we'll use the same print approach with "Save as PDF" option
    handlePrint()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold">
            Report Cards Preview ({reports.length} student{reports.length !== 1 ? 's' : ''})
          </h2>
          <div className="flex items-center gap-2">
            <Button onClick={handleDownloadPDF} className="bg-green-600 hover:bg-green-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Preview Content - Scrollable */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div ref={printRef}>
            {reports.map((report, idx) => (
              <div
                key={report.learner.id}
                className="report-card bg-white shadow-lg mb-6 mx-auto"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '10mm',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Watermark */}
                <div
                  className="watermark"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.08,
                    width: '200px',
                    height: '200px',
                    zIndex: 0
                  }}
                >
                  <img 
                    src={currentSchool?.logo_url || `/logos/${currentSchool?.code}.png`} 
                    alt={`${currentSchool?.name || 'School'} Logo`} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    onError={(e) => {
                      // Fallback to initials if logo not found
                      const target = e.currentTarget as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                </div>

                {/* Content */}
                <div className="content" style={{ position: 'relative', zIndex: 1 }}>
                  {/* Header */}
                  <div
                    className="header"
                    style={{
                      border: '2px solid #000',
                      backgroundColor: '#fffacd',
                      padding: '10px',
                      marginBottom: '10px',
                      textAlign: 'center'
                    }}
                  >
                    <h1 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                      {currentSchool?.name || 'School'}
                    </h1>
                    <div className="info" style={{ fontSize: '10px', fontWeight: 600 }}>
                      SCHOOL REPORT FORM {sessionInfo?.year || 'N/A'} | {sessionInfo?.exam_types?.name?.toUpperCase() || 'EXAM'} | TERM {sessionInfo?.term || 'N/A'} | {className}
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="student-info" style={{ marginBottom: '10px', fontSize: '11px' }}>
                    <span className="label" style={{ fontWeight: 'bold', color: '#1e40af' }}>STUDENT&apos;S NAME:</span>
                    <span className="name" style={{ marginLeft: '10px', fontWeight: 600, textTransform: 'uppercase', textDecoration: 'underline' }}>
                      {report.learner.name}
                    </span>
                    {report.learner.admission_number && (
                      <span style={{ marginLeft: '20px' }}>
                        <span style={{ fontWeight: 'bold' }}>ASSESSMENT NO:</span> {report.learner.admission_number}
                      </span>
                    )}
                  </div>

                  {/* Marks Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#d4d4d4' }}>
                        <th className="subject-col" style={{ border: '1px solid #000', padding: '6px', color: '#1e40af', textAlign: 'left' }}>Subject</th>
                        <th className="marks-col" style={{ border: '1px solid #000', padding: '6px', color: '#9400d3', textAlign: 'center', width: '50px' }}>Marks</th>
                        <th colSpan={4} style={{ border: '1px solid #000', padding: '6px', backgroundColor: '#d4d4d4', textAlign: 'center', color: '#666' }}>RUBRIC</th>
                      </tr>
                      <tr style={{ backgroundColor: '#d4d4d4' }}>
                        <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                        <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                        <th style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', width: '30px' }}>EE</th>
                        <th style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', width: '30px' }}>ME</th>
                        <th style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', width: '30px' }}>AE</th>
                        <th style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', width: '30px' }}>BE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject) => {
                        const score = report.marks[subject.id]
                        const rubric = score !== null && score !== undefined ? score >= 80 ? 'EE' : score >= 60 ? 'ME' : score >= 40 ? 'AE' : 'BE' : ''
                        return (
                          <tr key={subject.id}>
                            <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 600, fontSize: '9px' }}>{subject.name}</td>
                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>{score ?? ''}</td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'EE' ? '✓' : ''}</td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'ME' ? '✓' : ''}</td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'AE' ? '✓' : ''}</td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'BE' ? '✓' : ''}</td>
                          </tr>
                        )
                      })}
                      <tr className="total-row" style={{ backgroundColor: '#fffacd' }}>
                        <td style={{ border: '1px solid #000', padding: '8px', color: '#dc2626', fontWeight: 'bold', fontSize: '11px' }}>TOTAL MARKS</td>
                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>{report.total}</td>
                        <td colSpan={4} style={{ border: '1px solid #000', padding: '8px' }}></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Position and Rubric */}
                  <div className="position-rubric" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '10px' }}>
                    <div className="position">
                      <p style={{ marginBottom: '5px', fontWeight: 'bold' }}>CLASS POSITION: <u>{report.rank}</u></p>
                      <p style={{ marginBottom: '5px', fontWeight: 'bold' }}>OUT OF: <u>{totalStudents}</u></p>
                      <p style={{ fontWeight: 'bold' }}>AVERAGE: {report.average.toFixed(1)}%</p>
                    </div>
                    <div className="rubric-legend" style={{ textAlign: 'right', fontSize: '9px', color: '#666' }}>
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="comments" style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '5px' }}>TEACHER&apos;S COMMENTS:</p>
                    <div className="line" style={{ borderBottom: '1px dotted #000', height: '40px' }}></div>
                  </div>

                  {/* Dates */}
                  <div className="dates" style={{ display: 'flex', gap: '15px', marginBottom: '10px', fontSize: '9px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 'bold' }}>SCHOOL CLOSED ON: ______________</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 'bold' }}>RESUMES ON: ______________</p>
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="signature" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '10px', fontSize: '9px' }}>
                    <div>
                      <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>TEACHER: _________________</p>
                      <p style={{ fontWeight: 'bold' }}>SIGNATURE: _________________</p>
                    </div>
                    <div className="stamp" style={{ width: '60px', height: '40px', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#999' }}>
                      STAMP
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
