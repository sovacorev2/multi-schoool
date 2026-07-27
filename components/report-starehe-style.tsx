'use client'

import { useSchool } from '@/lib/school-context'
import { getSubjectDisplay } from '@/lib/subject-utils'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Printer, Download } from 'lucide-react'
import { getGradeLevelByClass, isUpperClass, GRADING_SCALE_SIMPLE, GRADING_SCALE_EXTENDED, getLevelByTotal } from '@/lib/grading-utils'
import { PathwayAnalysis } from '@/components/pathway-analysis'
import { calculatePathwayScores } from '@/lib/pathways'

interface StudentReport {
  learner: { id: string; name: string; admission_number: string | null; gender?: string; parent_phone?: string | null }
  marks: Record<string, number | null>
  subjectPositions?: Record<string, number>
  total: number
  rank: number
  average: number
  streamRank?: number
  streamTotal?: number
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

interface TermHistory {
  term: number
  year: number
  total: number
  average: number
  rank: number
  streamRank?: number
  daysAbsent?: number
  exam_type?: string
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
  subjectInitialsMap?: Record<string, string>
}

// CBC Performance Level helper
function getCBCPerformanceLevel(score: number, className: string, schoolName?: string): { level: string; points: number } {
  const result = getGradeLevelByClass(score, className, schoolName)
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
function getCBCRemarks(score: number | null, className: string, schoolName?: string): string {
  if (score === null || score === undefined) return 'No data'
  const perf = getCBCPerformanceLevel(score, className, schoolName)
  if (perf.level.startsWith('EE')) return 'Exceptional performance'
  if (perf.level.startsWith('ME')) return 'Good performance'
  if (perf.level.startsWith('AE')) return 'Fair performance, continue practicing'
  if (perf.level.startsWith('BE')) return 'Needs improvement, seek help'
  return ''
}

// Helper function to generate automatic teacher comment based on average performance level
function getAutoTeacherComment(averageLevel: string): string {
  const level = averageLevel.toUpperCase()
  
  // Below Expectation comments
  if (level === 'BE1') {
    return 'Learner requires a lot of support to complete learning tasks. Participation in class activities is minimal and needs improvement. More practice and concentration are needed for better performance.'
  }
  if (level === 'BE2') {
    return 'Learner is making slow progress but still requires close guidance. Attempts class activities though confidence is still low. With more effort and practice, performance can improve gradually.'
  }
  if (level.startsWith('BE')) {
    return 'Learner requires additional support to complete learning tasks. Participation needs improvement. More practice and concentration are needed for better performance.'
  }
  
  // Approaching Expectation comments
  if (level === 'AE1') {
    return 'Learner is beginning to understand concepts but needs more support. Shows signs of improvement in class activities and assignments. Regular revision will help achieve expected outcomes.'
  }
  if (level === 'AE2') {
    return 'Learner demonstrates improving understanding of concepts taught. Participates in learning activities and shows positive progress. Continued effort will enable the learner to meet expectations fully.'
  }
  if (level.startsWith('AE')) {
    return 'Learner is beginning to understand concepts and shows signs of improvement. Continued effort and regular revision will help achieve expected outcomes.'
  }
  
  // Meeting Expectation comments
  if (level === 'ME1') {
    return 'Learner demonstrates satisfactory understanding of concepts. Completes assigned tasks well and participates actively in class. Keep working hard to maintain steady progress.'
  }
  if (level === 'ME2') {
    return 'Learner consistently achieves the expected learning outcomes. Demonstrates confidence and good participation during lessons. Maintain the good performance and positive learning spirit.'
  }
  if (level.startsWith('ME')) {
    return 'Learner demonstrates satisfactory understanding and participates well in class activities. Keep working hard to maintain steady progress.'
  }
  
  // Exceeding Expectation comments
  if (level === 'EE1') {
    return 'Learner demonstrates very good understanding and application of concepts. Participates actively and produces high-quality work. Continue striving for excellence in all learning activities.'
  }
  if (level === 'EE2') {
    return 'Outstanding performance! Learner shows excellent mastery of concepts and exceptional creativity. A role model for peers. Keep up the excellent work and continue inspiring others.'
  }
  if (level.startsWith('EE')) {
    return 'Learner demonstrates excellent understanding and application of concepts. Participates actively and produces high-quality work. Continue striving for excellence.'
  }
  
  return ''
}

// Helper function to check if class is JSS (grades 7-9)
function isJSSClass(className: string): boolean {
  const normalized = className.toUpperCase()
  return /GRADE\s*[7-9]|CLASS\s*[7-9]|FORM\s*[1-3]|JSS\s*[1-3]/i.test(normalized)
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
  classTeacherName,
  subjectInitialsMap = {}
}: ReportStareheStyleProps) {
  const { currentSchool } = useSchool()
  const reportRef = useRef<HTMLDivElement>(null)

  if (!isOpen || reports.length === 0) return null
  
  console.log('[v0] ReportStareheStyle rendering:', {
    schoolName: currentSchool?.name,
    schoolLogoUrl: currentSchool?.logo_url,
    reportsCount: reports.length,
    className,
    firstReportData: reports[0] ? {
      name: reports[0].learner?.name,
      overall_rank: reports[0].overall_rank,
      rank: reports[0].rank,
      total_in_grade: reports[0].total_in_grade,
      hasOverallRankProperty: 'overall_rank' in reports[0],
      hasTotalInGradeProperty: 'total_in_grade' in reports[0]
    } : null
  })
  
  // A class is streamed if it has 3+ words (e.g., "Grade 7 EAST")
  // Single-word grades like "Grade 7" or "Grade 2" are NOT streamed
  const classWords = (className || '').trim().split(/\s+/)
  const isStreamedClass = classWords.length > 2
  const streamName = isStreamedClass ? classWords.slice(2).join(' ') : ''

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
                      body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.3; background: white; }
                      @page { size: A4; margin: 5mm; }
                      .page-break { page-break-after: always; page-break-inside: avoid; }
                      .hidden { display: none; }
                      .print\\:table { display: table; }
                      img { max-width: 100%; height: auto; display: block; }
                      table { width: 100%; border-collapse: collapse; font-size: inherit; margin-bottom: 4px; }
                      th, td { border: 1px solid #333; padding: 5px; word-break: break-word; }
                      th { background-color: #ddd; font-weight: bold; }
                      tr { orphans: 2; widows: 2; }
                      svg { display: block; margin: 0 auto; max-width: 100%; }
                      .text-center { text-align: center; }
                      .text-left { text-align: left; }
                      .text-xs { font-size: 13px; }
                      .text-sm { font-size: 14px; }
                      .text-lg { font-size: 16px; }
                      .font-bold { font-weight: bold; }
                      .italic { font-style: italic; }
                      .uppercase { text-transform: uppercase; }
                      .border { border: 1px solid #333; }
                      .border-2 { border: 2px solid #333; }
                      .border-b-2 { border-bottom: 2px solid #333; }
                      .border-r-2 { border-right: 2px solid #333; }
                      .border-b { border-bottom: 1px solid #333; }
                      .border-t { border-top: 1px solid #333; }
                      .p-1 { padding: 3px; }
                      .p-2 { padding: 5px; }
                      .p-3 { padding: 8px; }
                      .p-4 { padding: 10px; }
                      .mb-1 { margin-bottom: 1px; }
                      .mb-2 { margin-bottom: 2px; }
                      .mb-3 { margin-bottom: 3px; }
                      .mb-4 { margin-bottom: 4px; }
                      .mt-1 { margin-top: 1px; }
                      .mt-2 { margin-top: 2px; }
                      .mt-0\.5 { margin-top: 1px; }
                      .gap-3 { gap: 4px; }
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
                      .pb-3 { padding-bottom: 5px; }
                      .pb-1 { padding-bottom: 1px; }
                      .pb-2 { padding-bottom: 3px; }
                      .min-h-6 { min-height: 18px; }
                      .min-h-12 { min-height: 28px; }
                      .min-h-14 { min-height: 35px; }
                      .w-20 { width: 50px; }
                      .h-20 { height: 50px; }
                      .w-32 { width: 90px; }
                      .h-32 { height: 90px; }
                      .space-y-1 > * + * { margin-top: 1px; }
                      .space-y-2 > * + * { margin-top: 2px; }
                      .space-y-0\.5 > * + * { margin-top: 1px; }
                      @media print {
                        body { margin: 0; padding: 0; font-size: 14px; min-height: 100vh; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        * { orphans: 3; widows: 3; }
                        img { page-break-inside: avoid; display: block !important; visibility: visible !important; }
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
                      body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.5; background: white; }
                      @page { size: A4; margin: 8mm; }
                      .page-break { page-break-after: always; page-break-inside: avoid; }
                      .hidden { display: none; }
                      .print\\:table { display: table; }
                      img { max-width: 100%; height: auto; display: block; }
                      table { width: 100%; border-collapse: collapse; font-size: inherit; margin-bottom: 8px; }
                      th, td { border: 1px solid #333; padding: 7px; word-break: break-word; }
                      th { background-color: #ddd; font-weight: bold; }
                      tr { orphans: 2; widows: 2; }
                      svg { display: block; margin: 0 auto; max-width: 100%; }
                      .text-center { text-align: center; }
                      .text-left { text-align: left; }
                      .text-xs { font-size: 13px; }
                      .text-sm { font-size: 14px; }
                      .text-lg { font-size: 16px; }
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
                      .mb-1 { margin-bottom: 2px; }
                      .mb-2 { margin-bottom: 4px; }
                      .mb-3 { margin-bottom: 6px; }
                      .mb-4 { margin-bottom: 8px; }
                      .mt-1 { margin-top: 2px; }
                      .mt-2 { margin-top: 4px; }
                      .mt-0\.5 { margin-top: 1px; }
                      .gap-3 { gap: 8px; }
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
                const perf = getCBCPerformanceLevel(score || 0, className, currentSchool?.name)
                const remarks = getCBCRemarks(score, className, currentSchool?.name)
                return { subject, score, level: perf.level, points: perf.points, remarks }
              })

              const totalPoints = subjectData.reduce((sum, s) => sum + s.points, 0)
              const maxPointsPerSubject = isUpperClass(className) ? 8 : 4
              const maxPoints = subjects.length * maxPointsPerSubject
              const meanMark = report.average
              // Use getLevelByTotal so school-specific absolute scales (e.g. St Mary's Nambale)
              // are applied correctly. Falls back to average-based grading for all other schools.
              const meanPerf = getLevelByTotal(report.total, subjects.length, className, currentSchool?.name)
                ?? getCBCPerformanceLevel(meanMark, className, currentSchool?.name)

              return (
                <div key={report.learner.id || idx} className="bg-white page-break" style={{ padding: '12px', minHeight: '100vh', pageBreakInside: 'avoid', fontFamily: 'Times New Roman, serif' }}>
                  {/* School Header */}
                  <div style={{ textAlign: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #999' }}>
                    {/* Logo - only show if logo_url exists */}
                    {currentSchool?.logo_url && (
                      <img 
                        src={currentSchool.logo_url} 
                        alt="School Logo" 
                        style={{ width: '60px', height: '60px', margin: '0 auto 5px', objectFit: 'contain', display: 'block' }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.style.display = 'none'
                        }}
                      />
                    )}
                    
                    {/* School Name */}
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#003366', marginBottom: '3px', letterSpacing: '1px' }}>
                      {(currentSchool && currentSchool.name) || 'SCHOOL'}
                    </div>
                    
                    {/* Motto/Tagline */}
                    {currentSchool && currentSchool.tagline && (
                      <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#666', marginBottom: '8px' }}>
                        {currentSchool.tagline}
                      </div>
                    )}
                    
                    {/* School Contacts - only show if set */}
                    {(currentSchool?.email || currentSchool?.phone) && (
                      <div style={{ fontSize: '10px', color: '#555', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #ddd' }}>
                        {currentSchool.email && <div>Email: {currentSchool.email}</div>}
                        {currentSchool.phone && <div>Phone: {currentSchool.phone}</div>}
                      </div>
                    )}
                  </div>

                  {/* Report Title Box with Exam Type */}
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ border: '2px solid #000', display: 'inline-block', padding: '4px 12px', fontSize: '11px', fontWeight: 'bold' }}>
                      PROGRESS REPORT - TERM {sessionInfo?.term || 'N/A'}, {sessionInfo?.year || 'N/A'}
                    </div>
                    {sessionInfo?.exam_types?.name && (
                      <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#003366', marginTop: '2px' }}>
                        {sessionInfo.exam_types.name.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Student Info Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                    <div><strong>NAME:</strong> <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{report.learner.name}</span></div>
                    <div><strong>ASSESSMENT NO:</strong> <span style={{ fontSize: '13px' }}>{report.learner.admission_number || '-'}</span></div>
                    <div><strong>CLASS:</strong> <span style={{ fontSize: '13px' }}>{className}</span></div>
                  </div>

                  {/* Main Marks Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#ddd' }}>
                        <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>SUBJECT</th>
                        <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>SCORE (%)</th>
                        <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>LEVEL</th>
                        <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>PTS</th>
                        {/* Hide CLASS POS column for individual reports */}
                        {reports.length > 1 && (
                          <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>CLASS POS</th>
                        )}
                        <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>REMARKS</th>
                        <th style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>INITIALS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectData.map((item, i) => (
                        <tr key={item.subject.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>{item.subject.name.toUpperCase()}</td>
                          <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontSize: '12px' }}>{item.score ?? '-'}</td>
                          <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>{item.level}</td>
                          <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontSize: '12px' }}>{item.points}</td>
                          {/* Hide CLASS POS cell for individual reports */}
                          {reports.length > 1 && (
                            <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontSize: '12px' }}>{report.subjectPositions?.[item.subject.id] || '-'}/{totalStudents}</td>
                          )}
                          <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'left', fontSize: '11px' }}>{item.remarks}</td>
                          <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {subjectInitialsMap[item.subject.id] || ''}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold' }}>
                        <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'left', fontSize: '12px' }}>TOTAL</td>
                        <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontSize: '12px' }}>{report.total}</td>
                        <td style={{ border: '1px solid #666', padding: '7px', fontSize: '12px' }}></td>
                        <td style={{ border: '1px solid #666', padding: '7px', textAlign: 'center', fontSize: '12px' }}>{totalPoints}</td>
                        {/* Hide CLASS POS column for individual reports */}
                        {reports.length > 1 && (
                          <td style={{ border: '1px solid #666', padding: '7px', fontSize: '12px' }}></td>
                        )}
                        <td style={{ border: '1px solid #666', padding: '7px', fontSize: '12px' }}></td>
                        <td style={{ border: '1px solid #666', padding: '7px', fontSize: '12px' }}></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Mean Marks and Summary Row */}
                  <div style={{ marginBottom: '6px', fontSize: '11px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isStreamedClass ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                      <div style={{ border: '1px solid #666', padding: '6px', fontSize: '11px' }}>
                        <div><strong>MEAN MARKS:</strong> {meanMark.toFixed(1)}</div>
                        <div style={{ marginTop: '3px' }}><strong>PERF LEVEL:</strong> {meanPerf.level}</div>
                      </div>
                      <div style={{ border: '1px solid #666', padding: '6px', fontSize: '11px' }}>
                        <div><strong>TOTAL PTS:</strong> {totalPoints}/{maxPoints}</div>
                        <div style={{ marginTop: '3px' }}><strong>{isStreamedClass ? 'STREAM POS' : 'POSITION'}:</strong> {report.rank}/{totalStudents}</div>
                      </div>
                      {isStreamedClass && (
                        <div style={{ border: '1px solid #666', padding: '6px', fontSize: '11px' }}>
                          <div><strong>OVERALL POS:</strong> {report.overall_rank || report.rank}/{report.total_in_grade || totalStudents}</div>
                          <div style={{ marginTop: '3px' }}><strong>STREAM:</strong> {streamName}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Charts Row - Side by Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginBottom: '3px' }}>
                    {/* JSS: Pathway Analysis OR Other Grades: Subject Distribution */}
                    <div style={{ border: '1px solid #666', padding: '4px' }}>
                      {isJSSClass(className) ? (
                        // Pathway Analysis for JSS (Grades 7-9)
                        <>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10px', textAlign: 'center' }}>PATHWAY ANALYSIS</div>
                          <div style={{ fontSize: '8px', lineHeight: '1.4' }}>
                            <PathwayAnalysis
                              scores={calculatePathwayScores(report.marks, subjects)}
                              className="print-pathway-analysis"
                            />
                          </div>
                        </>
                      ) : (
                        // Subject Distribution Pie Chart for Other Grades
                        <>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10px', textAlign: 'center' }}>SUBJECT DISTRIBUTION</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg viewBox="0 0 80 80" style={{ width: '50px', height: '50px', flexShrink: 0 }}>
                              {(() => {
                                const scores = subjectData.map(s => s.score || 0)
                                const total = scores.reduce((a, b) => a + b, 0)
                                if (total === 0) return <text x="40" y="45" textAnchor="middle" fontSize="7">No Data</text>
                                
                                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']
                                
                                let currentAngle = 0
                                const slices = scores.map((score, i) => {
                                  if (score === 0) return null
                                  const sliceAngle = (score / total) * 360
                                  const startAngle = currentAngle
                                  const endAngle = currentAngle + sliceAngle
                                  
                                  const startRad = (startAngle * Math.PI) / 180
                                  const endRad = (endAngle * Math.PI) / 180
                                  
                                  const x1 = 40 + 28 * Math.cos(startRad)
                                  const y1 = 40 + 28 * Math.sin(startRad)
                                  const x2 = 40 + 28 * Math.cos(endRad)
                                  const y2 = 40 + 28 * Math.sin(endRad)
                                  
                                  const largeArc = sliceAngle > 180 ? 1 : 0
                                  const path = `M 40 40 L ${x1} ${y1} A 28 28 0 ${largeArc} 1 ${x2} ${y2} Z`
                                  
                                  currentAngle = endAngle
                                  
                                  return <path key={i} d={path} fill={colors[i % colors.length]} stroke="white" strokeWidth="0.5" />
                                })
                                return slices
                              })()}
                            </svg>
                            {/* Legend with percentages */}
                            <div style={{ fontSize: '8px', lineHeight: '1.3', flex: 1 }}>
                              {(() => {
                                const scores = subjectData.map(s => s.score || 0)
                                const total = scores.reduce((a, b) => a + b, 0)
                                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']
                                return subjectData.slice(0, 8).map((subject, i) => {
                                  const percentage = total > 0 ? ((scores[i] / total) * 100).toFixed(0) : 0
                                  return (
                                    <div key={subject.subject.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                                      <span style={{ width: '6px', height: '6px', backgroundColor: colors[i % colors.length], marginRight: '3px', flexShrink: 0 }}></span>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getSubjectDisplay(subject.subject.name)} {percentage}%</span>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bar Chart - Performance Trend (Accumulates all exams) */}
                    <div style={{ border: '1px solid #666', padding: '6px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '11px' }}>PERFORMANCE TREND</div>
                      <svg viewBox="0 0 140 95" style={{ width: '100%', maxWidth: '130px', margin: '0 auto', display: 'block', height: 'auto' }}>
                        {/* Y-axis */}
                        <line x1="20" y1="10" x2="20" y2="70" stroke="#999" strokeWidth="0.5" />
                        {/* X-axis */}
                        <line x1="20" y1="70" x2="135" y2="70" stroke="#999" strokeWidth="0.5" />
                        {/* Y-axis labels */}
                        <text x="18" y="12" fontSize="6" textAnchor="end">100</text>
                        <text x="18" y="32" fontSize="6" textAnchor="end">75</text>
                        <text x="18" y="42" fontSize="6" textAnchor="end">50</text>
                        <text x="18" y="62" fontSize="6" textAnchor="end">25</text>
                        <text x="18" y="72" fontSize="6" textAnchor="end">0</text>
                        {/* Horizontal gridlines */}
                        <line x1="20" y1="25" x2="135" y2="25" stroke="#eee" strokeWidth="0.3" strokeDasharray="1,1" />
                        <line x1="20" y1="40" x2="135" y2="40" stroke="#eee" strokeWidth="0.3" strokeDasharray="1,1" />
                        <line x1="20" y1="55" x2="135" y2="55" stroke="#eee" strokeWidth="0.3" strokeDasharray="1,1" />
                        
                        {(() => {
                          // Get student's history from termHistory
                          const learnerHistory = termHistory?.[report.learner.id] || []
                          
                          // Build all exams including history + current
                          const allExams: any[] = []
                          
                          // Add historical exams (sorted chronologically)
                          if (learnerHistory && learnerHistory.length > 0) {
                            learnerHistory.forEach((h: any) => {
                              // Build short label: e.g., "OPE T1" or "MID T1"
                              const termStr = String(h.term || '').match(/\d+/)?.[0] || h.term
                              const examPrefix = h.exam_type 
                                ? h.exam_type.substring(0, 3).toUpperCase() 
                                : 'EXM'
                              const examLabel = `${examPrefix} T${termStr}`
                              allExams.push({
                                label: examLabel,
                                average: h.average || h.total || 0,
                                isHistory: true
                              })
                            })
                          }
                          
                          // Only add current exam if there's no history (i.e., first time entering marks)
                          // If there's history, the most recent should already be in the data
                          if (allExams.length === 0) {
                            allExams.push({
                              label: 'CURRENT',
                              average: meanMark,
                              isHistory: false
                            })
                          }
                          
                          const totalBars = allExams.length
                          const chartWidth = 110 // 135 - 25 (start position)
                          const barWidth = Math.min(15, (chartWidth / totalBars) * 0.7)
                          const barSpacing = chartWidth / totalBars
                          
                          return allExams.map((exam, i) => {
                            const x = 25 + (i * barSpacing) + (barSpacing - barWidth) / 2
                            const barHeight = (exam.average / 100) * 60
                            const y = 70 - barHeight
                            // Last exam is current (orange), others are previous (blue)
                            const isCurrentExam = i === allExams.length - 1
                            const fill = isCurrentExam ? '#f97316' : '#1e40af'
                            
                            return (
                              <g key={i}>
                                {/* Bar */}
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={barHeight}
                                  fill={fill}
                                  opacity="0.85"
                                />
                                {/* Exam label below bar - ROTATED VERTICALLY */}
                                <g transform={`translate(${x + barWidth / 2}, 78) rotate(45)`}>
                                  <text
                                    x="0"
                                    y="0"
                                    fontSize="3.5"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="#000"
                                    fontWeight="500"
                                  >
                                    {exam.label}
                                  </text>
                                </g>
                              </g>
                            )
                          })
                        })()}
                        {/* Legend - Updated to show exam progression */}
                        <rect x="30" y="86" width="3" height="3" fill="#1e40af" />
                        <text x="35" y="89" fontSize="6">Previous Exams</text>
                        <rect x="75" y="86" width="3" height="3" fill="#f97316" />
                        <text x="80" y="89" fontSize="6">Latest Exam</text>
                      </svg>
                    </div>
                  </div>

                  {/* Grading Legend */}
                  <div style={{ marginBottom: '3px', padding: '4px', border: '1px solid #999', backgroundColor: '#fff' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '1px', fontSize: '10px' }}>CBE LEVELS:</div>
                    <div style={{ fontSize: '9px', lineHeight: '1.2' }}>
                      EE=Exceeding-4 | ME=Meeting-3 | AE=Approaching-2 | BE=Below-1
                    </div>
                  </div>

                  {/* Remarks Sections */}
                  <div style={{ marginBottom: '2px' }}>
                    {/* Class Teacher Remarks - Auto-generated based on performance level (except St James) */}
                    <div style={{ border: '1px solid #666', marginBottom: '2px' }}>
                      <div style={{ backgroundColor: '#ddd', fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #666', fontSize: '10px' }}>CLASS TEACHER&apos;S REMARKS:</div>
                      <div style={{ padding: '4px', minHeight: '18px', fontSize: '9px', lineHeight: '1.2', overflow: 'hidden' }}>
                        {/* Show auto comment for all schools except St James */}
                        {currentSchool?.code?.toLowerCase() !== 'stjames' && currentSchool?.name?.toLowerCase()?.includes('st james') !== true
                          ? getAutoTeacherComment(meanPerf.level)
                          : ''}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '3px', borderTop: '1px solid #666', fontSize: '9px' }}>
                        <div>NAME: <span style={{ fontWeight: 'bold' }}>{classTeacherName || '________________'}</span></div>
                        <div>SIGN: ________________</div>
                      </div>
                      <div style={{ padding: '3px', fontSize: '9px' }}>DATE: ________________</div>
                    </div>

                    {/* Parent/Guardian Remarks */}
                    <div style={{ border: '1px solid #666' }}>
                      <div style={{ backgroundColor: '#ddd', fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #666', fontSize: '10px' }}>PARENT/GUARDIAN&apos;S REMARKS:</div>
                      <div style={{ padding: '4px', minHeight: '18px' }}></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '3px', borderTop: '1px solid #666', fontSize: '9px' }}>
                        <div>NAME: ________________</div>
                        <div>SIGN: ________________</div>
                      </div>
                      <div style={{ padding: '3px', fontSize: '9px' }}>DATE: ________________</div>
                    </div>
                  </div>

                  {/* Next Term Info */}
                  <div style={{ border: '1px solid #666', padding: '3px', fontSize: '9px' }}>
                    <div style={{ fontWeight: 'bold' }}>NEXT TERM FROM: ________ TO: ________</div>
                  </div>
                </div>
              )
            } catch (err) {
              console.error('Error rendering report:', err)
              return (
                <div key={idx} className="text-red-500 p-4 border border-red-300 bg-red-50 rounded">
                  <div className="font-bold">Error rendering report for {report.learner.name}</div>
                  <div className="text-sm mt-2">{err instanceof Error ? err.message : String(err)}</div>
                </div>
              )
            }
          })}
        </div>
      </div>
    </div>
  )
}
