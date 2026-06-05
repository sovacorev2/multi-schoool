'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { getSubjectDisplay } from '@/lib/subject-utils'
import { getGradeLevelByClass } from '@/lib/grading-utils'

interface LearnerData {
  id: string
  name: string
  stream: string
  className: string
  marks: { [subjectName: string]: number | null }
  total: number
  average: number
  rank: number
}

interface SubjectData {
  id: string
  name: string
}

export default function PrintCombinedMarklistPage() {
  const searchParams = useSearchParams()
  const { currentSchool } = useSchool()
  const [learners, setLearners] = useState<LearnerData[]>([])
  const [subjects, setSubjects] = useState<SubjectData[]>([])
  const [baseClassName, setBaseClassName] = useState('')
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const sessionId = searchParams.get('sessionId')
    const baseClass = searchParams.get('baseClass')

    if (!sessionId || !baseClass || !currentSchool?.id) return

    setBaseClassName(baseClass)

    try {
      // Get session info
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*, exam_types(*)')
        .eq('id', sessionId)
        .single()

      setSessionInfo(sessionData)

      // Find all classes matching the base class
      const { data: allClasses } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('name')

      if (!allClasses) return

      const streamClasses = allClasses.filter(c => {
        const pattern = new RegExp(`^${baseClass}(\\s+.+)?$`, 'i')
        return pattern.test(c.name)
      })

      const allSubjectsMap = new Map<string, SubjectData>()
      const allLearners: Omit<LearnerData, 'rank'>[] = []

      for (const cls of streamClasses) {
        // Get matching session for this class
        const { data: classSessions } = await supabase
          .from('sessions')
          .select('*, exam_types(*)')
          .eq('class_id', cls.id)
          .eq('term', sessionData?.term)
          .eq('year', sessionData?.year)
          .eq('exam_type_id', sessionData?.exam_type_id)

        const clsSessionId = classSessions?.[0]?.id

        // Fetch data
        const [subjectsRes, learnersRes, marksRes] = await Promise.all([
          supabase.from('subjects').select('*').eq('class_id', cls.id).order('name'),
          supabase.from('learners').select('*').eq('class_id', cls.id).order('name'),
          clsSessionId ? supabase.from('marks').select('*').eq('session_id', clsSessionId) : Promise.resolve({ data: [] }),
        ])

        const clsSubjects = subjectsRes.data || []
        const clsLearners = learnersRes.data || []
        const clsMarks = marksRes.data || []

        // Add subjects to map
        clsSubjects.forEach(subj => {
          if (!allSubjectsMap.has(subj.name)) {
            allSubjectsMap.set(subj.name, { id: subj.id, name: subj.name })
          }
        })

        const streamName = cls.name.replace(new RegExp(`^${baseClass}\\s*`, 'i'), '').trim() || 'Main'

        // Process learners
        clsLearners.forEach(learner => {
          const learnerMarks: { [subjectName: string]: number | null } = {}
          let total = 0
          let count = 0

          clsSubjects.forEach(subj => {
            const mark = clsMarks.find(m => m.learner_id === learner.id && m.subject_id === subj.id)
            learnerMarks[subj.name] = mark?.score ?? null
            if (mark?.score !== null && mark?.score !== undefined) {
              total += mark.score
              count++
            }
          })

          allLearners.push({
            id: learner.id,
            name: learner.name,
            stream: streamName,
            className: cls.name,
            marks: learnerMarks,
            total,
            average: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
          })
        })
      }

      // Sort and assign ranks
      allLearners.sort((a, b) => b.total - a.total)
      let rank = 1
      let prevTotal = -1
      const rankedLearners: LearnerData[] = allLearners.map((learner, idx) => {
        if (learner.total !== prevTotal) {
          rank = idx + 1
        }
        prevTotal = learner.total
        return { ...learner, rank }
      })

      setLearners(rankedLearners)
      setSubjects(Array.from(allSubjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('Error fetching combined marklist:', err)
    } finally {
      setLoading(false)
    }
  }, [searchParams, currentSchool])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading && learners.length > 0) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, learners])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading combined marklist...</div>
      </div>
    )
  }

  // Calculate stream stats
  const streamStats = new Map<string, { count: number; avgTotal: number }>()
  learners.forEach(l => {
    const existing = streamStats.get(l.stream) || { count: 0, avgTotal: 0 }
    existing.count++
    existing.avgTotal += l.average
    streamStats.set(l.stream, existing)
  })

  const gradeAverage = learners.length > 0
    ? (learners.reduce((a, l) => a + l.average, 0) / learners.length).toFixed(1)
    : '0'

  return (
    <div className="bg-white" style={{ margin: 0, padding: 0 }}>
      <div
        style={{
          width: '297mm',
          minHeight: '210mm',
          margin: '0 auto',
          padding: '8mm',
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
            width: '300px',
            height: '300px'
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
              padding: '8px',
              marginBottom: '10px',
              textAlign: 'center'
            }}
          >
            <h1 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
              {currentSchool?.name || 'School'}
            </h1>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#000' }}>
              COMBINED MARKLIST - {baseClassName.toUpperCase()} (ALL STREAMS)
            </div>
            <div style={{ fontSize: '10px', color: '#333', marginTop: '3px' }}>
              {sessionInfo?.exam_types?.name?.toUpperCase()} | TERM {sessionInfo?.term} | {sessionInfo?.year}
            </div>
          </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-2 mb-4 text-center">
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-blue-600">{learners.length}</div>
          <div className="text-xs text-gray-500">Total Learners</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-green-600">{subjects.length}</div>
          <div className="text-xs text-gray-500">Subjects</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-purple-600">{streamStats.size}</div>
          <div className="text-xs text-gray-500">Streams</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-amber-600">{gradeAverage}</div>
          <div className="text-xs text-gray-500">Grade Average</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold" style={{ color: '#1a3a52' }}>
            {(() => {
              if (learners.length === 0) return '-'
              const levels = learners.map(l => getGradeLevelByClass(Math.round(l.average), baseClassName)?.level).filter(Boolean)
              if (!Array.isArray(levels) || levels.length === 0) return '-'
              const levelCounts = levels.reduce((acc, level) => {
                acc[level] = (acc[level] || 0) + 1
                return acc
              }, {} as Record<string, number>)
              const mostCommon = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]
              return mostCommon ? mostCommon[0] : '-'
            })()}
          </div>
          <div className="text-xs text-gray-500">Average Performance Level</div>
        </div>
      </div>

      {/* Stream Breakdown */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from(streamStats.entries())
          .sort((a, b) => (b[1].avgTotal / b[1].count) - (a[1].avgTotal / a[1].count))
          .map(([stream, stats], idx) => (
            <div key={stream} className={`px-3 py-1 rounded border ${idx === 0 ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
              <span className="font-semibold">{stream}:</span> {stats.count} learners, {(stats.avgTotal / stats.count).toFixed(1)} avg
            </div>
          ))}
      </div>

      {/* Combined Marklist Table */}
      <table className="w-full border-collapse border text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1 text-center w-8">Rank</th>
            <th className="border p-1 text-left">Name</th>
            <th className="border p-1 text-center w-16">Stream</th>
            {subjects.map(subj => (
              <th key={subj.id} className="border p-1 text-center" style={{ minWidth: '60px' }} title={subj.name}>
                {getSubjectDisplay(subj.name)}
              </th>
            ))}
            <th className="border p-1 text-center w-12">Total</th>
            <th className="border p-1 text-center w-16">Level</th>
          </tr>
        </thead>
        <tbody>
          {learners.map((learner, idx) => {
            const isTop3 = learner.rank <= 3
            const rowBg = learner.rank === 1 ? 'bg-yellow-50' : learner.rank === 2 ? 'bg-gray-100' : learner.rank === 3 ? 'bg-amber-50' : ''
            return (
              <tr key={learner.id} className={rowBg}>
                <td className={`border p-1 text-center ${isTop3 ? 'font-bold' : ''}`}>{learner.rank}</td>
                <td className={`border p-1 ${isTop3 ? 'font-semibold' : ''}`}>{learner.name}</td>
                <td className="border p-1 text-center text-xs">{learner.stream}</td>
                {subjects.map(subj => {
                  const score = learner.marks[subj.name]
                  const level = score !== null ? getGradeLevelByClass(score, baseClassName)?.level : '-'
                  let scoreClass = ''
                  if (score !== null) {
                    if (score >= 80) scoreClass = 'text-green-700'
                    else if (score >= 50) scoreClass = 'text-blue-600'
                    else if (score >= 30) scoreClass = 'text-amber-600'
                    else scoreClass = 'text-red-600'
                  }
                  return (
                    <td key={subj.id} className={`border p-1 text-center ${scoreClass}`}>
                      <div className="font-semibold">{score !== null ? score : '-'}</div>
                      <div style={{ color: '#1a3a52', fontSize: '9px', fontWeight: 'bold' }}>{level}</div>
                    </td>
                  )
                })}
                <td className="border p-1 text-center font-bold">{learner.total}</td>
                <td className="border p-1 text-center font-semibold" style={{ color: '#1a3a52' }}>
                  {getGradeLevelByClass(Math.round(learner.average), baseClassName)?.level || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
            <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            <p>{currentSchool?.name} - Examination Management System</p>
          </div>
        </div>
      </div>
    </div>
  )
}
