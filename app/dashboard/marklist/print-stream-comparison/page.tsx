'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'

interface StreamData {
  name: string
  streamName: string
  classId: string
  totalLearners: number
  classAvg: number
  passRate: number
  subjects: { name: string; mean: number; highest: number; lowest: number }[]
  topPerformer: { name: string; total: number; average: number }
  rubricDistribution: { r4: number; r3: number; r2: number; r1: number }
}

export default function PrintStreamComparisonPage() {
  const searchParams = useSearchParams()
  const { currentSchool } = useSchool()
  const [streams, setStreams] = useState<StreamData[]>([])
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

      const streamsData: StreamData[] = []

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

        // Fetch data for this stream
        const [subjectsRes, learnersRes, marksRes] = await Promise.all([
          supabase.from('subjects').select('*').eq('class_id', cls.id),
          supabase.from('learners').select('*').eq('class_id', cls.id),
          clsSessionId ? supabase.from('marks').select('*').eq('session_id', clsSessionId) : Promise.resolve({ data: [] }),
        ])

        const clsSubjects = subjectsRes.data || []
        const clsLearners = learnersRes.data || []
        const clsMarks = marksRes.data || []

        // Calculate per-subject stats
        const subjectStats = clsSubjects.map(subj => {
          const subjMarks = clsMarks.filter(m => m.subject_id === subj.id && m.score !== null)
          const scores = subjMarks.map(m => m.score || 0)
          return {
            name: subj.name,
            mean: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
            highest: scores.length > 0 ? Math.max(...scores) : 0,
            lowest: scores.length > 0 ? Math.min(...scores) : 0,
          }
        })

        // Calculate learner totals
        const learnerTotals = clsLearners.map(learner => {
          const learnerMarks = clsMarks.filter(m => m.learner_id === learner.id && m.score !== null)
          const total = learnerMarks.reduce((a, m) => a + (m.score || 0), 0)
          const avg = learnerMarks.length > 0 ? total / learnerMarks.length : 0
          return { name: learner.name, total, average: avg }
        }).sort((a, b) => b.total - a.total)

        const learnersWithMarks = learnerTotals.filter(l => l.total > 0)
        const classAvg = learnersWithMarks.length > 0
          ? Math.round((learnersWithMarks.reduce((a, l) => a + l.average, 0) / learnersWithMarks.length) * 10) / 10
          : 0
        const passRate = learnersWithMarks.length > 0
          ? Math.round((learnersWithMarks.filter(l => l.average >= 50).length / learnersWithMarks.length) * 100)
          : 0

        // Rubric distribution
        let r4 = 0, r3 = 0, r2 = 0, r1 = 0
        clsMarks.forEach(m => {
          const score = m.score || 0
          if (score >= 80) r4++
          else if (score >= 50) r3++
          else if (score >= 30) r2++
          else if (score > 0) r1++
        })

        const streamName = cls.name.replace(new RegExp(`^${baseClass}\\s*`, 'i'), '').trim()
        streamsData.push({
          name: cls.name,
          streamName: streamName || 'Main',
          classId: cls.id,
          totalLearners: clsLearners.length,
          classAvg,
          passRate,
          subjects: subjectStats,
          topPerformer: learnerTotals[0] || { name: 'N/A', total: 0, average: 0 },
          rubricDistribution: { r4, r3, r2, r1 },
        })
      }

      // Sort by average
      streamsData.sort((a, b) => b.classAvg - a.classAvg)
      setStreams(streamsData)
    } catch (err) {
      console.error('Error fetching stream comparison:', err)
    } finally {
      setLoading(false)
    }
  }, [searchParams, currentSchool])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading && streams.length > 0) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, streams])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading stream comparison report...</div>
      </div>
    )
  }

  // Get all unique subjects
  const allSubjects = new Set<string>()
  streams.forEach(s => s.subjects.forEach(subj => allSubjects.add(subj.name)))
  const subjectsList = Array.from(allSubjects).sort()

  return (
    <div className="bg-white" style={{ margin: 0, padding: 0 }}>
      <div
        style={{
          width: '297mm',
          minHeight: '210mm',
          margin: '0 auto',
          padding: '10mm',
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
              padding: '10px',
              marginBottom: '15px',
              textAlign: 'center'
            }}
          >
            <h1 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
              {currentSchool?.name || 'School'}
            </h1>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#000' }}>
              STREAM COMPARISON REPORT - {baseClassName.toUpperCase()}
            </div>
            <div style={{ fontSize: '10px', color: '#333', marginTop: '5px' }}>
              {sessionInfo?.exam_types?.name?.toUpperCase()} | TERM {sessionInfo?.term} | {sessionInfo?.year}
            </div>
          </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6 text-center">
        <div className="border p-3 rounded">
          <div className="text-2xl font-bold text-blue-600">{streams.length}</div>
          <div className="text-xs text-muted-foreground">Streams</div>
        </div>
        <div className="border p-3 rounded">
          <div className="text-2xl font-bold text-green-600">{streams.reduce((a, s) => a + s.totalLearners, 0)}</div>
          <div className="text-xs text-muted-foreground">Total Learners</div>
        </div>
        <div className="border p-3 rounded">
          <div className="text-2xl font-bold text-purple-600">{streams[0]?.streamName || '-'}</div>
          <div className="text-xs text-muted-foreground">Top Stream</div>
        </div>
        <div className="border p-3 rounded">
          <div className="text-2xl font-bold text-amber-600">
            {streams.length > 0 ? (streams.reduce((a, s) => a + s.classAvg, 0) / streams.length).toFixed(1) : '0'}
          </div>
          <div className="text-xs text-muted-foreground">Grade Average</div>
        </div>
      </div>

      {/* Stream Overview Table */}
      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-2">Stream Overview</h3>
        <table className="w-full text-sm border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Rank</th>
              <th className="border p-2 text-left">Stream</th>
              <th className="border p-2 text-center">Learners</th>
              <th className="border p-2 text-center">Mean</th>
              <th className="border p-2 text-center">Pass Rate</th>
              <th className="border p-2 text-left">Top Performer</th>
              <th className="border p-2 text-center">R4</th>
              <th className="border p-2 text-center">R3</th>
              <th className="border p-2 text-center">R2</th>
              <th className="border p-2 text-center">R1</th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream, idx) => (
              <tr key={stream.classId} className={idx === 0 ? 'bg-yellow-50' : ''}>
                <td className="border p-2 font-bold text-center">{idx + 1}</td>
                <td className="border p-2 font-medium">{stream.name}</td>
                <td className="border p-2 text-center">{stream.totalLearners}</td>
                <td className="border p-2 text-center font-semibold">{stream.classAvg}</td>
                <td className="border p-2 text-center">{stream.passRate}%</td>
                <td className="border p-2">{stream.topPerformer.name} ({stream.topPerformer.average.toFixed(1)})</td>
                <td className="border p-2 text-center text-green-600">{stream.rubricDistribution.r4}</td>
                <td className="border p-2 text-center text-blue-600">{stream.rubricDistribution.r3}</td>
                <td className="border p-2 text-center text-amber-600">{stream.rubricDistribution.r2}</td>
                <td className="border p-2 text-center text-red-600">{stream.rubricDistribution.r1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subject-by-Subject Comparison */}
      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-2">Subject Performance by Stream</h3>
        <table className="w-full text-xs border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-1 text-left">Subject</th>
              {streams.map(stream => (
                <th key={stream.classId} className="border p-1 text-center" colSpan={3}>
                  {stream.streamName}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              <th className="border p-1"></th>
              {streams.map(stream => (
                <React.Fragment key={`header-${stream.classId}`}>
                  <th className="border p-1 text-center text-blue-600">Mean</th>
                  <th className="border p-1 text-center text-green-600">High</th>
                  <th className="border p-1 text-center text-red-600">Low</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjectsList.map(subjName => {
              const maxMean = Math.max(...streams.map(s => s.subjects.find(sub => sub.name === subjName)?.mean || 0))
              return (
                <tr key={subjName}>
                  <td className="border p-1 font-medium">{subjName}</td>
                  {streams.map(stream => {
                    const subj = stream.subjects.find(s => s.name === subjName)
                    const isHighest = subj && subj.mean === maxMean && maxMean > 0
                    return (
                      <React.Fragment key={`${stream.classId}-${subjName}`}>
                        <td className={`border p-1 text-center ${isHighest ? 'bg-green-100 font-bold' : ''}`}>
                          {subj?.mean || '-'}
                        </td>
                        <td className="border p-1 text-center text-green-600">{subj?.highest || '-'}</td>
                        <td className="border p-1 text-center text-red-600">{subj?.lowest || '-'}</td>
                      </React.Fragment>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-bold">
              <td className="border p-1">Overall Mean</td>
              {streams.map(stream => {
                const maxAvg = Math.max(...streams.map(s => s.classAvg))
                const isHighest = stream.classAvg === maxAvg && maxAvg > 0
                return (
                  <td key={`avg-${stream.classId}`} colSpan={3} className={`border p-1 text-center ${isHighest ? 'bg-green-200' : ''}`}>
                    {stream.classAvg}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ccc' }}>
            <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            <p>{currentSchool?.name} - Examination Management System</p>
          </div>
        </div>
      </div>
    </div>
  )
}
