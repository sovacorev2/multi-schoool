'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'

interface StudentReport {
  learner: { id: string; name: string; admission_number: string }
  marks: Record<string, number | null>
  total: number
  rank: number
  average: number
}

interface Subject {
  id: string
  name: string
}

export default function PrintReportsPage() {
  const searchParams = useSearchParams()
  const { currentSchool } = useSchool()
  const [reports, setReports] = useState<StudentReport[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        
        const sessionId = searchParams.get('sessionId')
        const classId = searchParams.get('classId')
        const studentIds = searchParams.get('studentIds')?.split(',') || []
        const isBulk = searchParams.get('bulk') === 'true'

        // Fetch session info
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*, exam_types(*)')
          .eq('id', sessionId)
          .single()

        setSessionInfo(sessionData)

        // Fetch class name
        if (classId) {
          const { data: classData } = await supabase
            .from('classes')
            .select('name')
            .eq('id', classId)
            .single()
          setClassName(classData?.name || '')
        }

        // Fetch subjects for the specific class
        const { data: subjectsData } = await supabase
          .from('subjects')
          .select('*')
          .eq('class_id', classId)
          .order('name')
        setSubjects(subjectsData || [])

        // Fetch marks and learner data
        if (isBulk && classId && sessionId) {
          // Get all learners for the class
          const { data: learners } = await supabase
            .from('learners')
            .select('id, name, admission_number')
            .eq('class_id', classId)
            .order('name')

          if (learners) {
            // Fetch marks for all learners
            const { data: marksData } = await supabase
              .from('marks')
              .select('*')
              .eq('session_id', sessionId)
              .in('learner_id', learners.map(l => l.id))

            const reportsList = learners.map(learner => {
              const learnerMarks: Record<string, number | null> = {}
              let total = 0
              subjectsData?.forEach(subject => {
                const mark = marksData?.find(m => m.learner_id === learner.id && m.subject_id === subject.id)
                learnerMarks[subject.id] = mark?.score ?? null
                if (mark?.score) total += mark.score
              })

              const average = subjectsData ? total / subjectsData.length : 0
              const rank = learners.filter(l => {
                const lTotal = subjectsData?.reduce((sum, s) => {
                  const m = marksData?.find(ma => ma.learner_id === l.id && ma.subject_id === s.id)
                  return sum + (m?.score || 0)
                }, 0) || 0
                return lTotal > total
              }).length + 1

              return {
                learner,
                marks: learnerMarks,
                total,
                rank,
                average
              }
            })
            setReports(reportsList)
          }
        }

        setLoading(false)
      } catch (error) {
        console.error('[v0] Error loading report data:', error)
        setLoading(false)
      }
    }

    loadData()
  }, [searchParams])

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="bg-white" style={{ margin: 0, padding: 0 }}>
      {reports.map((report, idx) => (
        <div
          key={report.learner.id}
          style={{
            width: '148mm',
            minHeight: '210mm',
            margin: '0 auto',
            padding: '10mm',
            pageBreakAfter: idx < reports.length - 1 ? 'always' : 'auto',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#fff',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Watermark Logo */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.08,
              zIndex: 0,
              pointerEvents: 'none',
              width: '200px',
              height: '200px'
            }}
          >
            <img 
              src={currentSchool?.logo_url || `/logos/${currentSchool?.code}.jpeg`} 
              alt={`${currentSchool?.name || 'School'} Logo`} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>

          {/* Main Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Header */}
            <div
              style={{
                border: '2px solid #000',
                backgroundColor: '#fffacd',
                padding: '10px',
                marginBottom: '10px',
                textAlign: 'center'
              }}
            >
              <h1 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
                {currentSchool?.name || 'School'}
              </h1>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#000' }}>
                SCHOOL REPORT FORM {sessionInfo?.year} | {sessionInfo?.exam_types?.name?.toUpperCase()} | TERM {sessionInfo?.term} | {className}
              </div>
            </div>

            {/* Student Name */}
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
              <span style={{ fontWeight: 'bold', color: '#1e40af' }}>STUDENT&apos;S NAME:</span>
              <span style={{ marginLeft: '10px', fontWeight: '600', textTransform: 'uppercase', textDecoration: 'underline' }}>
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
                <tr style={{ backgroundColor: '#d4d4d4', borderTop: '2px solid #000', borderBottom: '1px solid #000' }}>
                  <th style={{ border: '1px solid #000', padding: '6px', color: '#1e40af', fontWeight: 'bold', textAlign: 'left' }}>Subject</th>
                  <th style={{ border: '1px solid #000', padding: '6px', color: '#9400d3', fontWeight: 'bold', textAlign: 'center', width: '50px' }}>Marks</th>
                  <th colSpan={4} style={{ border: '1px solid #000', padding: '6px', backgroundColor: '#d4d4d4', fontWeight: 'bold', textAlign: 'center', color: '#666' }}>RUBRIC</th>
                </tr>
                <tr style={{ backgroundColor: '#d4d4d4', borderBottom: '2px solid #000' }}>
                  <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                  <th style={{ border: '1px solid #000', padding: '4px' }}></th>
                  <th style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', fontSize: '9px' }}>EE</th>
                  <th style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', fontSize: '9px' }}>ME</th>
                  <th style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', fontSize: '9px' }}>AE</th>
                  <th style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', fontSize: '9px' }}>BE</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => {
                  const score = report.marks[subject.id]
                  const rubric = score !== null && score !== undefined ? score >= 80 ? 'EE' : score >= 60 ? 'ME' : score >= 40 ? 'AE' : 'BE' : ''
                  return (
                    <tr key={subject.id} style={{ backgroundColor: '#fff' }}>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: '600', fontSize: '9px' }}>{subject.name}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>{score ?? ''}</td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'EE' ? '✓' : ''}</td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'ME' ? '✓' : ''}</td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'AE' ? '✓' : ''}</td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{rubric === 'BE' ? '✓' : ''}</td>
                    </tr>
                  )
                })}
                <tr style={{ backgroundColor: '#fffacd', borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
                  <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', color: '#dc2626', fontSize: '11px' }}>TOTAL MARKS</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>{report.total}</td>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '8px' }}></td>
                </tr>
              </tbody>
            </table>

            {/* Class Position and Rubric */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '10px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>CLASS POSITION: <u>{report.rank}</u></p>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>OUT OF: <u>{reports.length}</u></p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>AVERAGE: {report.average.toFixed(1)}%</p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '9px', color: '#666' }}>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold' }}>RUBRIC:</p>
                <p style={{ margin: '0 0 2px 0' }}>EE=Exceeds (80-100)</p>
                <p style={{ margin: '0 0 2px 0' }}>ME=Meets (60-79)</p>
                <p style={{ margin: '0 0 2px 0' }}>AE=Approaching (40-59)</p>
                <p style={{ margin: 0 }}>BE=Below (0-39)</p>
              </div>
            </div>

            {/* Teacher Comments */}
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '10px' }}>TEACHER&apos;S COMMENTS:</p>
              <div style={{ borderBottom: '1px dotted #000', height: '40px', marginBottom: '5px' }}></div>
            </div>

            {/* School Closure Dates */}
            <div style={{ marginBottom: '10px', display: 'flex', gap: '15px', fontSize: '9px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>SCHOOL CLOSED ON: ______________</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>RESUMES ON: ______________</p>
              </div>
            </div>

            {/* Signature Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '10px', fontSize: '9px' }}>
              <div>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>TEACHER: _________________</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>SIGNATURE: _________________</p>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid #000', paddingLeft: '10px' }}>
                <div style={{ width: '60px', height: '40px', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#999' }}>
                  STAMP
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
