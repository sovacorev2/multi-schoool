'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { cachedFetch, TTL } from '@/lib/query-cache'
import { getSubjectDisplay } from '@/lib/subject-utils'
import { getGradeLevelByClass } from '@/lib/grading-utils'

interface LearnerData {
  id: string
  name: string
  stream: string
  className: string
  marks: { [subjectName: string]: number | null }
  total: number
  totalPoints: number
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
  // Kakoli wants their marklist's "Total" column to show total rubric points
  // instead of total raw marks - same school-specific treatment applied to
  // the main marklist table.
  const isKakoli = currentSchool?.code?.toLowerCase() === 'kakoli' || currentSchool?.name?.toLowerCase().includes('kakoli')
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

      // Find all classes matching the base class - batch everything, no per-class loops
      const allClasses = await cachedFetch(
        `classes:${currentSchool.id}`,
        () => supabase.from('classes').select('id, name, school_id, display_order').eq('school_id', currentSchool.id).order('name').then(r => r.data ?? []),
        TTL.STATIC
      )

      if (!allClasses) return

      const streamClasses = allClasses.filter(c => {
        const pattern = new RegExp(`^${baseClass}(\\s+.+)?$`, 'i')
        return pattern.test(c.name)
      })

      const allSubjectsMap = new Map<string, SubjectData>()
      const allLearners: Omit<LearnerData, 'rank'>[] = []

      if (streamClasses.length === 0) return

      const streamClassIds = streamClasses.map(c => c.id)

      // 3 parallel batch queries instead of N×3 sequential queries
      const [streamSessions, allSubjectsData, allLearnersData] = await Promise.all([
        supabase.from('sessions').select('id, class_id, exam_type_id, term, year')
          .in('class_id', streamClassIds)
          .eq('term', sessionData?.term)
          .eq('year', sessionData?.year)
          .eq('exam_type_id', sessionData?.exam_type_id)
          .then(r => r.data ?? []),
        cachedFetch(`subjects:batch:${streamClassIds.join(',')}`, () =>
          supabase.from('subjects').select('id, name, class_id').in('class_id', streamClassIds).order('name').then(r => r.data ?? []),
          TTL.STATIC),
        cachedFetch(`learners:batch:${streamClassIds.join(',')}`, () =>
          supabase.from('learners').select('id, name, class_id').in('class_id', streamClassIds).order('name').then(r => r.data ?? []),
          TTL.STATIC),
      ])

      const sessionByClassId = new Map(streamSessions.map((s: any) => [s.class_id, s.id]))
      const sessionIds = streamSessions.map((s: any) => s.id)
      const allMarksData = sessionIds.length > 0
        ? await cachedFetch(`marks:batch:${sessionIds.join(',')}`, () =>
            supabase.from('marks').select('learner_id, subject_id, score, session_id').in('session_id', sessionIds).then(r => r.data ?? []),
            TTL.MARKS)
        : []

      for (const cls of streamClasses) {
        const clsSessionId = sessionByClassId.get(cls.id)
        const clsSubjects = allSubjectsData.filter((s: any) => s.class_id === cls.id)
        const clsLearners = allLearnersData.filter((l: any) => l.class_id === cls.id)
        const clsMarks = clsSessionId ? allMarksData.filter((m: any) => m.session_id === clsSessionId) : []

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
          let totalPoints = 0
          let count = 0

          clsSubjects.forEach(subj => {
            const mark = clsMarks.find(m => m.learner_id === learner.id && m.subject_id === subj.id)
            learnerMarks[subj.name] = mark?.score ?? null
            if (mark?.score !== null && mark?.score !== undefined) {
              total += mark.score
              count++
              const gradeInfo = getGradeLevelByClass(mark.score, cls.name, currentSchool?.name)
              if (gradeInfo?.points) totalPoints += gradeInfo.points
            }
          })

          allLearners.push({
            id: learner.id,
            name: learner.name,
            stream: streamName,
            className: cls.name,
            marks: learnerMarks,
            total,
            totalPoints,
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
          <div className="text-xs text-muted-foreground">Total Learners</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-green-600">{subjects.length}</div>
          <div className="text-xs text-muted-foreground">Subjects</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-purple-600">{streamStats.size}</div>
          <div className="text-xs text-muted-foreground">Streams</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold text-amber-600">{gradeAverage}</div>
          <div className="text-xs text-muted-foreground">Grade Average</div>
        </div>
        <div className="border p-2 rounded">
          <div className="text-lg font-bold" style={{ color: '#1a3a52' }}>
            {(() => {
              if (learners.length === 0) return '-'
              const levels = learners.map(l => getGradeLevelByClass(Math.round(l.average), baseClassName, currentSchool?.name)?.level).filter(Boolean)
              if (!Array.isArray(levels) || levels.length === 0) return '-'
              const levelCounts = levels.reduce((acc, level) => {
                acc[level] = (acc[level] || 0) + 1
                return acc
              }, {} as Record<string, number>)
              const mostCommon = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]
              return mostCommon ? mostCommon[0] : '-'
            })()}
          </div>
          <div className="text-xs text-muted-foreground">Average Performance Level</div>
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
              <React.Fragment key={subj.id}>
                <th className="border p-1 text-center" style={{ minWidth: '30px' }} title={subj.name}>
                  {getSubjectDisplay(subj.name)}
                </th>
                <th className="border p-1 text-center w-12">Level</th>
                <th className="border p-1 text-center w-12">Pts</th>
              </React.Fragment>
            ))}
            <th className="border p-1 text-center w-12">{isKakoli ? 'Total Points' : 'Total'}</th>
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
                  const performanceLevel = score !== null ? getGradeLevelByClass(score, baseClassName, currentSchool?.name) : null
                  let scoreClass = ''
                  if (score !== null) {
                    if (score >= 80) scoreClass = 'text-green-700 font-semibold'
                    else if (score >= 50) scoreClass = 'text-blue-600 font-semibold'
                    else if (score >= 30) scoreClass = 'text-amber-600'
                    else scoreClass = 'text-red-600'
                  }
                  return (
                    <React.Fragment key={subj.id}>
                      <td className={`border p-1 text-center ${scoreClass}`}>
                        {score !== null ? score : '-'}
                      </td>
                      <td className="border p-1 text-center font-bold" style={{ color: '#1a3a52' }}>
                        {performanceLevel ? performanceLevel.level : '-'}
                      </td>
                      <td className="border p-1 text-center font-bold" style={{ color: '#d97706' }}>
                        {performanceLevel ? performanceLevel.points : '-'}
                      </td>
                    </React.Fragment>
                  )
                })}
                <td className="border p-1 text-center font-bold">{isKakoli ? learner.totalPoints : learner.total}</td>
                <td className="border p-1 text-center font-semibold" style={{ color: '#1a3a52' }}>
                  {getGradeLevelByClass(Math.round(learner.average), baseClassName, currentSchool?.name)?.level || '-'}
                </td>
              </tr>
            )
          })}
          {/* Subject Means Row - per-subject class average across all combined streams */}
          <tr className="bg-gray-200 font-bold">
            <td className="border p-1 text-center" colSpan={3}>MEAN</td>
            {subjects.map(subj => {
              const scores = learners.map(l => l.marks[subj.name]).filter((m): m is number => m !== null && m !== undefined)
              const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
              const meanLevel = scores.length > 0 ? getGradeLevelByClass(Math.round(mean), baseClassName, currentSchool?.name) : null
              return (
                <React.Fragment key={`mean-${subj.id}`}>
                  <td className="border p-1 text-center">{scores.length > 0 ? mean.toFixed(1) : '-'}</td>
                  <td className="border p-1 text-center font-bold" style={{ color: '#1a3a52' }}>{meanLevel ? meanLevel.level : '-'}</td>
                  <td className="border p-1 text-center font-bold" style={{ color: '#d97706' }}>{meanLevel ? meanLevel.points : '-'}</td>
                </React.Fragment>
              )
            })}
            <td className="border p-1 text-center">
              {learners.length === 0
                ? '-'
                : isKakoli
                  ? (learners.reduce((a, l) => a + l.totalPoints, 0) / learners.length).toFixed(1)
                  : Math.round(learners.reduce((a, l) => a + l.total, 0) / learners.length)}
            </td>
            <td className="border p-1 text-center" style={{ color: '#1a3a52' }}>
              {learners.length > 0 ? (getGradeLevelByClass(Math.round(learners.reduce((a, l) => a + l.average, 0) / learners.length), baseClassName, currentSchool?.name)?.level || '-') : '-'}
            </td>
          </tr>
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
