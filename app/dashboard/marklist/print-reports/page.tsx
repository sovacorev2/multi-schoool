'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { getGradeLevelByClass } from '@/lib/grading-utils'

// Helper function to generate automatic teacher comment based on average performance level
function getAutoTeacherComment(averageLevel: string): string {
  const level = averageLevel.toUpperCase()
  
  if (level === 'BE1') return 'Learner requires a lot of support to complete learning tasks. Participation in class activities is minimal and needs improvement. More practice and concentration are needed for better performance.'
  if (level === 'BE2') return 'Learner is making slow progress but still requires close guidance. Attempts class activities though confidence is still low. With more effort and practice, performance can improve gradually.'
  if (level.startsWith('BE')) return 'Learner requires additional support to complete learning tasks. Participation needs improvement. More practice and concentration are needed for better performance.'
  
  if (level === 'AE1') return 'Learner is beginning to understand concepts but needs more support. Shows signs of improvement in class activities and assignments. Regular revision will help achieve expected outcomes.'
  if (level === 'AE2') return 'Learner demonstrates improving understanding of concepts taught. Participates in learning activities and shows positive progress. Continued effort will enable the learner to meet expectations fully.'
  if (level.startsWith('AE')) return 'Learner is beginning to understand concepts and shows signs of improvement. Continued effort and regular revision will help achieve expected outcomes.'
  
  if (level === 'ME1') return 'Learner demonstrates satisfactory understanding of concepts. Completes assigned tasks well and participates actively in class. Keep working hard to maintain steady progress.'
  if (level === 'ME2') return 'Learner consistently achieves the expected learning outcomes. Demonstrates confidence and good participation during lessons. Maintain the good performance and positive learning spirit.'
  if (level.startsWith('ME')) return 'Learner demonstrates satisfactory understanding and participates well in class activities. Keep working hard to maintain steady progress.'
  
  if (level === 'EE1') return 'Learner demonstrates very good understanding and application of concepts. Participates actively and produces high-quality work. Continue striving for excellence in all learning activities.'
  if (level === 'EE2') return 'Outstanding performance! Learner shows excellent mastery of concepts and exceptional creativity. A role model for peers. Keep up the excellent work and continue inspiring others.'
  if (level.startsWith('EE')) return 'Learner demonstrates excellent understanding and application of concepts. Participates actively and produces high-quality work. Continue striving for excellence.'
  
  return ''
}

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
          .select('id, name, class_id')
          .eq('class_id', classId)
          .order('name')
        setSubjects(subjectsData || [])

        // Fetch marks and learner data
        if (isBulk && classId && sessionId) {
          // Batch fetch learners and marks in parallel
          const [learnersRes, marksRes] = await Promise.all([
            supabase.from('learners').select('id, name, admission_number').eq('class_id', classId).order('name'),
            supabase.from('marks').select('learner_id, subject_id, score').eq('session_id', sessionId),
          ])
          const learners = learnersRes.data
          const marksData = marksRes.data

          if (learners) {

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
              src={currentSchool?.logo_url || `/logos/${currentSchool?.code}.png`} 
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
              </div>
            </div>

            {/* Teacher Comments - Auto-generated based on performance level (except St James) */}
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '10px' }}>TEACHER&apos;S COMMENTS:</p>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '40px', marginBottom: '5px', padding: '5px 0', fontSize: '9px', lineHeight: '1.4' }}>
                {/* Show auto comment for all schools except St James */}
                {(() => {
                  const isStJames = currentSchool?.code?.toLowerCase() === 'stjames' || currentSchool?.name?.toLowerCase()?.includes('st james')
                  if (isStJames) return ''
                  
                  // Calculate performance level from average
                  const perfLevel = report.average >= 80 ? 'EE' : report.average >= 60 ? 'ME' : report.average >= 40 ? 'AE' : 'BE'
                  // Add sublevel based on score within range
                  const sublevel = report.average % 20 >= 10 ? '2' : '1'
                  return getAutoTeacherComment(perfLevel + sublevel)
                })()}
              </div>
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
