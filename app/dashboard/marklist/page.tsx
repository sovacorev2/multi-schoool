'use client'

export const dynamic = 'force-dynamic'

import React from "react"
import { formatGradeWithPoints, getPerformanceLevelWithPoints, getGradeLevelByClass } from '@/lib/grading-utils'
import { getSubjectDisplay, normalizeSubjectName, areSubjectsEqual } from '@/lib/subject-utils'
import { sortClassesByLevel } from '@/lib/class-sort-utils'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { isNetworkError, getFallbackData, cacheFallbackData } from '@/lib/fallback-data'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Printer, AlertCircle, BarChart3, TrendingUp, School, GitCompareArrows, ArrowUpRight, ArrowDownRight, Minus, FileText, Users } from 'lucide-react'
import type { ExamType, Session, Subject, Learner, Mark } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'


import { ReportStareheStyle } from '@/components/report-starehe-style'




interface SessionWithExamType extends Session {
  exam_types?: ExamType | null
}

interface LearnerResult {
  learner: Learner
  marks: Record<string, number | null>
  total: number
  average: number
  rank: number
  overall_rank?: number
  total_in_grade?: number
}

export default function MarklistPage() {
  const { currentClass, currentSession: contextSession } = useClass()
  const { currentSchool } = useSchool()
  const [sessions, setSessions] = useState<SessionWithExamType[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [selectedTerm, setSelectedTerm] = useState<string>('')
  const [teacherName, setTeacherName] = useState<string>('')
  const [selectedSession, setSelectedSession] = useState<SessionWithExamType | null>(null)
  const [schoolPerformance, setSchoolPerformance] = useState<{
    category: string
    classes: {
      name: string
      classId: string
      totalLearners: number
      classAvg: number
      subjectCount: number
      rubricDistribution: { r4: number, r3: number, r2: number, r1: number }
      topSubject: string
      weakestSubject: string
    }[]
    categoryAvg: number
    totalLearners: number
  }[]>([])
  const [isLoadingSchool, setIsLoadingSchool] = useState(false)
  const [comparisonData, setComparisonData] = useState<{
    currentSession: { name: string; term: string; year: number } | null
    previousSession: { name: string; term: string; year: number } | null
    subjectComparisons: { name: string; currentMean: number; previousMean: number; change: number }[]
    topImprovers: { name: string; currentTotal: number; previousTotal: number; change: number }[]
    topDroppers: { name: string; currentTotal: number; previousTotal: number; change: number }[]
    currentClassAvg: number
    previousClassAvg: number
    learnerComparisons: { name: string; currentTotal: number; previousTotal: number; change: number; currentRank: number; previousRank: number }[]
  } | null>(null)
  const [isLoadingComparison, setIsLoadingComparison] = useState(false)
  const [comparisonClassId, setComparisonClassId] = useState<string>('')
  const [comparisonSessionId, setComparisonSessionId] = useState<string>('') // Allow manual selection of comparison exam
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([])
  const [streamComparisonData, setStreamComparisonData] = useState<{
    baseClassName: string
    streams: {
      name: string
      streamName: string
      classId: string
      totalLearners: number
      classAvg: number
      passRate: number
      subjects: { name: string; mean: number; highest: number; lowest: number }[]
      topPerformer: string
      rubricDistribution: { r4: number; r3: number; r2: number; r1: number }
    }[]
  } | null>(null)
  const [isLoadingStreams, setIsLoadingStreams] = useState(false)
  const [selectedBaseClass, setSelectedBaseClass] = useState<string>('')
  const [combinedMarklistData, setCombinedMarklistData] = useState<{
    baseClassName: string
    subjects: { id: string; name: string }[]
    learners: {
      id: string
      name: string
      stream: string
      className: string
      marks: { [subjectId: string]: number | null }
      total: number
      average: number
      rank: number
    }[]
  } | null>(null)
  const [isLoadingCombined, setIsLoadingCombined] = useState(false)
  const [selectedCombinedClass, setSelectedCombinedClass] = useState<string>('')
  const [certificateData, setCertificateData] = useState<{ studentName: string; subjectName: string; score: number; className: string; examName: string; term: string; year: number } | null>(null)
  const [studentReportData, setStudentReportData] = useState<LearnerResult | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportModalData, setReportModalData] = useState<LearnerResult[]>([])
  const [results, setResults] = useState<LearnerResult[]>([])
  const [termHistory, setTermHistory] = useState<Record<string, any[]>>({})
  
  // WhatsApp bulk send state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [whatsappQueue, setWhatsappQueue] = useState<LearnerResult[]>([])
  const [whatsappCurrentIndex, setWhatsappCurrentIndex] = useState(0)
  const [whatsappSentCount, setWhatsappSentCount] = useState(0)

  // Check if admin (has both currentClass and contextSession from context)
  const isAdminUser = !!(currentClass && contextSession)

  // Preschool classes use direct rubric (1-4), others use score-based rubric
  const PRESCHOOL_CLASSES = ['playgroup', 'pp1', 'pp2']
  const isPreschool = PRESCHOOL_CLASSES.includes(currentClass?.name?.toLowerCase() || '')

  const getRubric = (score: number | null): number | null => {
    if (score === null || score === undefined) return null
    if (isPreschool) {
      // For preschool, marks ARE rubrics (1-4)
      if (score >= 1 && score <= 4) return score
      return null
    }
    // For all other classes: score-based rubric
    if (score >= 80) return 4
    if (score >= 50) return 3
    if (score >= 30) return 2
    return 1
  }

  const fetchInitialData = useCallback(async () => {
    if (!currentClass) return

    const supabase = createClient()

    try {
      const [sessionsRes, subjectsRes, learnersRes] = await Promise.all([
        supabase.from('sessions').select('*, exam_types(*)').eq('class_id', currentClass.id),
        supabase.from('subjects').select('*').eq('class_id', currentClass.id).order('name'),
        supabase.from('learners').select('*').eq('class_id', currentClass.id).order('name'),
      ])

      // Only show exam sessions (those with exam_type_id) - these are created by teachers
      setSessions((sessionsRes.data || []).filter(s => s.exam_type_id !== null))
      setSubjects(subjectsRes.data || [])
      setLearners(learnersRes.data || [])
    } catch (err) {
      // Network error - use empty data for now
      console.log('[v0] Network error fetching data, using empty sets:', err)
      setSessions([])
      setSubjects([])
      setLearners([])
    }
    
    setIsLoading(false)
  }, [currentClass])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    if (!selectedSessionId) return

    async function fetchMarks() {
      const supabase = createClient()
      const { data } = await supabase
        .from('marks')
        .select('*')
        .eq('session_id', selectedSessionId)

      setMarks(data || [])
      const session = sessions.find((s) => s.id === selectedSessionId)
      setSelectedSession(session || null)
      setTeacherName(session?.teacher_name || '')
    }

    fetchMarks()
  }, [selectedSessionId, sessions])

  // Fetch school-wide performance data
  const fetchSchoolPerformance = useCallback(async () => {
    if (!selectedSession) return
    setIsLoadingSchool(true)

    const supabase = createClient()
    const PRESCHOOL = ['Playgroup', 'PP1', 'PP2']
    const CATEGORIES = [
      { name: 'Pre-School', classNames: ['Playgroup', 'PP1', 'PP2'] },
      { name: 'Lower Primary', classNames: ['Grade 1', 'Grade 2', 'Grade 3'] },
      { name: 'Upper Primary', classNames: ['Grade 4', 'Grade 5', 'Grade 6'] },
      { name: 'Junior Secondary', classNames: ['Grade 7', 'Grade 8', 'Grade 9'] },
    ]

    try {
      // Check if this is a PIN-authenticated teacher
      const teacherSessionStr = typeof window !== 'undefined' ? localStorage.getItem('teacher_session') : null
      const isPinAuthenticated = !!teacherSessionStr
      let teacherId: string | null = null
      
      if (isPinAuthenticated) {
        try {
          const teacherSession = JSON.parse(teacherSessionStr || '{}')
          teacherId = teacherSession.teacherId
          console.log('[v0] PIN teacher access restricted to assigned classes only')
        } catch (e) {
          console.error('[v0] Failed to parse teacher session')
        }
      }

      // Fetch all classes initially
      let { data: allClasses } = await supabase.from('classes').select('*').eq('school_id', currentSchool?.id).order('display_order')
      if (!allClasses) return
      
      // For PIN teachers: filter to only assigned classes
      if (isPinAuthenticated && teacherId) {
        const { data: teacherAssignments } = await supabase
          .from('teacher_assignments')
          .select('distinct class_id')
          .eq('user_id', teacherId)
        
        const assignedClassIds = new Set(teacherAssignments?.map(a => a.class_id) || [])
        allClasses = allClasses.filter(cls => assignedClassIds.has(cls.id))
        console.log('[v0] PIN teacher restricted to', allClasses.length, 'assigned classes')
      }

      // Get ALL matching sessions at once instead of per-class
      const { data: allSessions } = await supabase
        .from('sessions')
        .select('*, exam_types(*)')
        .eq('term', selectedSession.term)
        .eq('year', selectedSession.year)
        .eq('exam_type_id', selectedSession.exam_type_id)
      
      // Get ALL subjects and learners for all classes at once
      const classIds = allClasses.map(c => c.id)
      const { data: allSubjects } = await supabase
        .from('subjects')
        .select('*')
        .in('class_id', classIds)
      
      const { data: allLearners } = await supabase
        .from('learners')
        .select('*')
        .in('class_id', classIds)
      
      // Get ALL marks for the selected exam sessions
      const sessionIds = allSessions?.map(s => s.id) || []
      const { data: allMarks } = await supabase
        .from('marks')
        .select('*')
        .in('session_id', sessionIds)

      // Create lookup maps for fast access
      const sessionsByClassId = new Map()
      allSessions?.forEach(s => {
        sessionsByClassId.set(s.class_id, s)
      })
      
      const subjectsByClassId = new Map()
      allSubjects?.forEach(s => {
        if (!subjectsByClassId.has(s.class_id)) subjectsByClassId.set(s.class_id, [])
        subjectsByClassId.get(s.class_id).push(s)
      })
      
      const learnersByClassId = new Map()
      allLearners?.forEach(l => {
        if (!learnersByClassId.has(l.class_id)) learnersByClassId.set(l.class_id, [])
        learnersByClassId.get(l.class_id).push(l)
      })
      
      const marksBySessionId = new Map()
      allMarks?.forEach(m => {
        if (!marksBySessionId.has(m.session_id)) marksBySessionId.set(m.session_id, [])
        marksBySessionId.get(m.session_id).push(m)
      })

      const categoryResults = []

      for (const category of CATEGORIES) {
        const catClasses = allClasses.filter(c => {
          const className = c.name.trim()
          return category.classNames.some(catName => 
            className === catName || className.startsWith(catName + ' ')
          )
        })
        const classResults = []

        for (const cls of catClasses) {
          // Get session from map instead of querying
          const classSession = sessionsByClassId.get(cls.id)

          if (!classSession) {
            classResults.push({
              name: cls.name,
              classId: cls.id,
              totalLearners: 0,
              classAvg: 0,
              subjectCount: 0,
              rubricDistribution: { r4: 0, r3: 0, r2: 0, r1: 0 },
              topSubject: 'N/A',
              weakestSubject: 'N/A',
            })
            continue
          }

          const sessionId = classSession.id
          
          // Get data from maps instead of querying
          const clsSubjects = subjectsByClassId.get(cls.id) || []
          const clsLearners = learnersByClassId.get(cls.id) || []
          const clsMarks = marksBySessionId.get(sessionId) || []
          const isPreschoolClass = PRESCHOOL.includes(cls.name)

          // Calculate averages per subject
          const subjectAvgs: { name: string; avg: number }[] = []
          let totalR4 = 0, totalR3 = 0, totalR2 = 0, totalR1 = 0

          for (const subj of clsSubjects) {
            const subjMarks = clsMarks.filter(m => m.subject_id === subj.id && m.score !== null)
            const sum = subjMarks.reduce((acc, m) => acc + (m.score || 0), 0)
            const avg = subjMarks.length > 0 ? sum / subjMarks.length : 0
            subjectAvgs.push({ name: subj.name, avg })

            // Count rubric distribution
            for (const m of subjMarks) {
              const score = m.score || 0
              let rubric: number
              if (isPreschoolClass) {
                rubric = score >= 1 && score <= 4 ? score : 0
              } else {
                rubric = score >= 80 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1
              }
              if (rubric === 4) totalR4++
              else if (rubric === 3) totalR3++
              else if (rubric === 2) totalR2++
              else if (rubric === 1) totalR1++
            }
          }

          const overallAvg = subjectAvgs.length > 0
            ? subjectAvgs.reduce((a, b) => a + b.avg, 0) / subjectAvgs.length
            : 0

          const sorted = [...subjectAvgs].sort((a, b) => b.avg - a.avg)

          classResults.push({
            name: cls.name,
            classId: cls.id,
            totalLearners: clsLearners.length,
            classAvg: Math.round(overallAvg * 10) / 10,
            subjectCount: clsSubjects.length,
            rubricDistribution: { r4: totalR4, r3: totalR3, r2: totalR2, r1: totalR1 },
            topSubject: sorted[0]?.name || 'N/A',
            weakestSubject: sorted[sorted.length - 1]?.name || 'N/A',
          })
        }

        const catAvg = classResults.length > 0
          ? classResults.reduce((a, b) => a + b.classAvg, 0) / classResults.filter(c => c.classAvg > 0).length || 0
          : 0

        // Only add category if it has classes
        if (classResults.length > 0) {
          categoryResults.push({
            category: category.name,
            classes: classResults,
            categoryAvg: Math.round(catAvg * 10) / 10,
            totalLearners: classResults.reduce((a, b) => a + b.totalLearners, 0),
          })
        }
      }

      setSchoolPerformance(categoryResults)
    } catch (err) {
      console.error('School performance error:', err)
    } finally {
      setIsLoadingSchool(false)
    }
  }, [selectedSession])

  // Stream Comparison: Compare streams within the same grade level
  const fetchStreamComparison = useCallback(async (baseClassName: string) => {
    if (!selectedSession || !baseClassName) return
    setIsLoadingStreams(true)

    const supabase = createClient()

    try {
      // Find all classes that start with the base class name
      const { data: allClasses } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool?.id)
        .order('name')
      
      if (!allClasses) return

      // Filter to only classes that match the base class pattern
      const streamClasses = allClasses.filter(c => {
        const pattern = new RegExp(`^${baseClassName}(\\s+.+)?$`, 'i')
        return pattern.test(c.name)
      })

      if (streamClasses.length === 0) {
        setStreamComparisonData(null)
        return
      }

      // Batch fetch all sessions for stream classes at once
      const streamClassIds = streamClasses.map(c => c.id)
      const { data: allSessions } = await supabase
        .from('sessions')
        .select('*, exam_types(*)')
        .in('class_id', streamClassIds)
        .eq('term', selectedSession.term)
        .eq('year', selectedSession.year)
        .eq('exam_type_id', selectedSession.exam_type_id)

      // Batch fetch all subjects and learners
      const { data: allSubjects } = await supabase
        .from('subjects')
        .select('*')
        .in('class_id', streamClassIds)
      
      const { data: allLearners } = await supabase
        .from('learners')
        .select('*')
        .in('class_id', streamClassIds)
      
      // Batch fetch all marks for matching sessions
      const sessionIds = allSessions?.map(s => s.id) || []
      const { data: allMarks } = await supabase
        .from('marks')
        .select('*')
        .in('session_id', sessionIds)

      // Create lookup maps
      const sessionsByClassId = new Map()
      allSessions?.forEach(s => {
        sessionsByClassId.set(s.class_id, s)
      })
      
      const subjectsByClassId = new Map()
      allSubjects?.forEach(s => {
        if (!subjectsByClassId.has(s.class_id)) subjectsByClassId.set(s.class_id, [])
        subjectsByClassId.get(s.class_id).push(s)
      })
      
      const learnersByClassId = new Map()
      allLearners?.forEach(l => {
        if (!learnersByClassId.has(l.class_id)) learnersByClassId.set(l.class_id, [])
        learnersByClassId.get(l.class_id).push(l)
      })
      
      const marksBySessionId = new Map()
      allMarks?.forEach(m => {
        if (!marksBySessionId.has(m.session_id)) marksBySessionId.set(m.session_id, [])
        marksBySessionId.get(m.session_id).push(m)
      })

      const streamsData = []

      for (const cls of streamClasses) {
        // Get session from map
        const classSession = sessionsByClassId.get(cls.id)

        if (!classSession) {
          streamsData.push({
            name: cls.name,
            streamName: cls.name.replace(new RegExp(`^${baseClassName}\\s*`, 'i'), '') || 'Main',
            classId: cls.id,
            totalLearners: 0,
            classAvg: 0,
            passRate: 0,
            subjects: [],
            topPerformer: 'N/A',
            rubricDistribution: { r4: 0, r3: 0, r2: 0, r1: 0 },
          })
          continue
        }

        const sessionId = classSession.id

        // Get all data from maps (no more queries!)
        const clsSubjects = subjectsByClassId.get(cls.id) || []
        const clsLearners = learnersByClassId.get(cls.id) || []
        const clsMarks = marksBySessionId.get(sessionId) || []

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

        const streamName = cls.name.replace(new RegExp(`^${baseClassName}\\s*`, 'i'), '').trim()
        streamsData.push({
          name: cls.name,
          streamName: streamName || 'Main',
          classId: cls.id,
          totalLearners: clsLearners.length,
          classAvg,
          passRate,
          subjects: subjectStats,
          topPerformer: learnerTotals[0] ? learnerTotals[0].name : 'N/A',
          rubricDistribution: { r4, r3, r2, r1 },
        })
      }

      // Sort streams by average (descending)
      streamsData.sort((a, b) => b.classAvg - a.classAvg)

      setStreamComparisonData({
        baseClassName,
        streams: streamsData,
      })
    } catch (err) {
      console.error('[v0] Stream comparison error:', err)
      if (err instanceof Error) {
        console.error('[v0] Error details:', err.message, err.stack)
      }
      alert('Error loading stream comparison. Please try again.')
    } finally {
      setIsLoadingStreams(false)
    }
  }, [selectedSession, currentSchool])

  // Get unique base class names for stream comparison dropdown
  const getBaseClassNames = useCallback(() => {
    const baseNames = new Set<string>()
    allClasses.forEach(cls => {
      const match = cls.name.match(/^(PP\s*\d+|Grade\s+\d+|Form\s+\d+)/i)
      if (match) {
        baseNames.add(match[1])
      }
    })
    return Array.from(baseNames).sort((a, b) => {
      const getOrder = (name: string) => {
        if (name.toUpperCase().startsWith('PP')) return parseInt(name.replace(/PP\s*/i, '')) || 0
        if (name.toUpperCase().includes('GRADE')) return 10 + (parseInt(name.replace(/GRADE\s*/i, '')) || 0)
        if (name.toUpperCase().includes('FORM')) return 100 + (parseInt(name.replace(/FORM\s*/i, '')) || 0)
        return 999
      }
      return getOrder(a) - getOrder(b)
    })
  }, [allClasses])

  // Combined Marklist: Fetch all streams for a grade and create a single unified marklist
  const fetchCombinedMarklist = useCallback(async (baseClassName: string) => {
    if (!selectedSession || !baseClassName) return
    setIsLoadingCombined(true)
    setCombinedMarklistData(null)

    const supabase = createClient()

    try {
      const { data: allClassesData } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool?.id)
        .order('name')

      if (!allClassesData) return

      const streamClasses = allClassesData.filter(c => {
        const pattern = new RegExp(`^${baseClassName}(\\s+.+)?$`, 'i')
        return pattern.test(c.name)
      })

      if (streamClasses.length === 0) {
        setCombinedMarklistData(null)
        return
      }

      const allSubjectsMap = new Map<string, { id: string; name: string }>()
      const allLearners: {
        id: string
        name: string
        stream: string
        className: string
        classId: string
        marks: { [subjectId: string]: number | null }
        total: number
        average: number
      }[] = []

      for (const cls of streamClasses) {
        const { data: classSessions } = await supabase
          .from('sessions')
          .select('*, exam_types(*)')
          .eq('class_id', cls.id)
          .eq('term', selectedSession.term)
          .eq('year', selectedSession.year)
          .eq('exam_type_id', selectedSession.exam_type_id)

        const sessionId = classSessions?.[0]?.id

        const [subjectsRes, learnersRes, marksRes] = await Promise.all([
          supabase.from('subjects').select('*').eq('class_id', cls.id).order('name'),
          supabase.from('learners').select('*').eq('class_id', cls.id).order('name'),
          sessionId ? supabase.from('marks').select('*').eq('session_id', sessionId) : Promise.resolve({ data: [] }),
        ])

        const clsSubjects = subjectsRes.data || []
        const clsLearners = learnersRes.data || []
        const clsMarks = marksRes.data || []

        clsSubjects.forEach(subj => {
          if (!allSubjectsMap.has(subj.name)) {
            allSubjectsMap.set(subj.name, { id: subj.id, name: subj.name })
          }
        })

        const streamName = cls.name.replace(new RegExp(`^${baseClassName}\\s*`, 'i'), '').trim() || 'Main'

        clsLearners.forEach(learner => {
          const learnerMarks: { [subjectId: string]: number | null } = {}
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
            classId: cls.id,
            marks: learnerMarks,
            total,
            average: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
          })
        })
      }

      allLearners.sort((a, b) => b.total - a.total)
      let rank = 1
      let prevTotal = -1
      allLearners.forEach((learner, idx) => {
        if (learner.total !== prevTotal) {
          rank = idx + 1
        }
        (learner as any).rank = rank
        prevTotal = learner.total
      })

      const subjectsArray = Array.from(allSubjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

      setCombinedMarklistData({
        baseClassName,
        subjects: subjectsArray,
        learners: allLearners.map(l => ({ ...l, rank: (l as any).rank })),
      })
    } catch (err) {
      console.error('Combined marklist error:', err)
    } finally {
      setIsLoadingCombined(false)
    }
  }, [selectedSession, currentSchool])

  // Exam comparison: find the previous session and compare
  const fetchExamComparison = useCallback(async (overrideClassId?: string) => {
    if (!selectedSession) {
      console.log('[v0] No selectedSession, skipping comparison')
      return
    }
    const targetClassId = overrideClassId || currentClass?.id
    if (!targetClassId) {
      console.log('[v0] No targetClassId, skipping comparison')
      return
    }
    
    console.log('[v0] Starting comparison fetch for class:', targetClassId, 'session:', selectedSession.id)
    setIsLoadingComparison(true)
    setComparisonData(null)

    const supabase = createClient()

    // Helper: get exam order from name (flexible matching)
    const getExamOrder = (name: string): number => {
      const lower = name.toLowerCase()
      if (lower.includes('opener')) return 0
      if (lower.includes('mid')) return 1
      if (lower.includes('end')) return 2
      return 3
    }

    try {
      // Fetch all sessions for the target class
      const { data: allSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, exam_types(*)')
        .eq('class_id', targetClassId)

      if (sessionsError) {
        console.error('[v0] Error fetching sessions:', sessionsError)
        setIsLoadingComparison(false)
        return
      }

      if (!allSessions || allSessions.length === 0) {
        console.log('[v0] No sessions found for class:', targetClassId)
        setIsLoadingComparison(false)
        return
      }

      console.log('[v0] Found', allSessions.length, 'sessions for class')

      // Need at least 2 sessions to compare
      if (allSessions.length < 2) {
        console.log('[v0] Only 1 session exists, cannot compare (need at least 2)')
        setIsLoadingComparison(false)
        return
      }

      // Build ordered list: Term 1 Opener, Term 1 Mid Term, Term 1 End Term, Term 2 Opener, etc.
      const termOrder = (term: string): number => {
        if (term.includes('1')) return 0
        if (term.includes('2')) return 1
        if (term.includes('3')) return 2
        return 3
      }

      const ordered = allSessions
        .map(s => ({
          ...s,
          sortKey: (s.year * 1000) + (termOrder(s.term) * 10) + getExamOrder(s.exam_types?.name || ''),
        }))
        .sort((a, b) => a.sortKey - b.sortKey)

      console.log('[v0] Sessions ordered:', ordered.map(s => `${s.exam_types?.name} ${s.term} ${s.year}`))
      console.log('[v0] Looking for session ID:', selectedSession.id)

      let currentIdx = ordered.findIndex(s => s.id === selectedSession.id)
      console.log('[v0] Current session index:', currentIdx)

      // If the selected session is not in this class's sessions, find the matching one by term/year/exam_type
      let currentSessionForComparison = selectedSession
      if (currentIdx === -1) {
        console.log('[v0] Selected session not found in class sessions, finding matching session...')
        // Find session with same term, year, exam_type for the target class
        const match = ordered.find(s =>
          s.term === selectedSession.term &&
          s.year === selectedSession.year &&
          s.exam_type_id === selectedSession.exam_type_id
        )
        if (match) {
          currentSessionForComparison = match
          currentIdx = ordered.indexOf(match)
          console.log('[v0] Found matching session at index:', currentIdx)
        } else {
          // Use the most recent session as current
          currentIdx = ordered.length - 1
          currentSessionForComparison = ordered[currentIdx]
          console.log('[v0] No exact match, using most recent session at index:', currentIdx)
        }
      }

      // Check if we can do comparison (need a previous session)
      if (currentIdx <= 0) {
        console.log('[v0] Current session is first or not found, no previous session available')
        setIsLoadingComparison(false)
        return
      }

      // If teacher selected a specific comparison exam, use that. Otherwise use previous exam.
      let previousSession
      if (comparisonSessionId) {
        previousSession = ordered.find(s => s.id === comparisonSessionId)
        if (!previousSession) {
          console.log('[v0] Selected comparison session not found in ordered list')
          setIsLoadingComparison(false)
          return
        }
        console.log('[v0] Using teacher-selected comparison exam:', previousSession.exam_types?.name)
      } else {
        previousSession = ordered[currentIdx - 1]
        console.log('[v0] Using previous exam (auto-select):', previousSession.exam_types?.name)
      }
      
      console.log('[v0] Comparing:', previousSession.exam_types?.name, 'vs', currentSessionForComparison.exam_types?.name)

  // Fetch subjects, learners, and marks for both sessions (for the target class)
  const [targetSubjectsRes, targetLearnersRes, currentMarksRes, previousMarksRes] = await Promise.all([
    supabase.from('subjects').select('*').eq('class_id', targetClassId).order('name'),
        supabase.from('learners').select('*').eq('class_id', targetClassId).order('name'),
        supabase.from('marks').select('*').eq('session_id', currentSessionForComparison.id),
        supabase.from('marks').select('*').eq('session_id', previousSession.id),
      ])

      const targetSubjects = targetSubjectsRes.data || []
      const targetLearners = targetLearnersRes.data || []
      const currentMarks = currentMarksRes.data || []
      const previousMarks = previousMarksRes.data || []

      console.log('[v0] Fetched:', { subjects: targetSubjects.length, learners: targetLearners.length, currentMarks: currentMarks.length, previousMarks: previousMarks.length })

      // Subject comparisons - use whatever data exists (even partial)
      const subjectComparisons = targetSubjects.map(subject => {
        const curScores = currentMarks.filter(m => m.subject_id === subject.id && m.score !== null).map(m => m.score!)
        const prevScores = previousMarks.filter(m => m.subject_id === subject.id && m.score !== null).map(m => m.score!)
        const curMean = curScores.length > 0 ? curScores.reduce((a, b) => a + b, 0) / curScores.length : 0
        const prevMean = prevScores.length > 0 ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length : 0
        return { name: subject.name, currentMean: Math.round(curMean * 10) / 10, previousMean: Math.round(prevMean * 10) / 10, change: Math.round((curMean - prevMean) * 10) / 10 }
      })

      // Learner comparisons
      const learnerTotals: Record<string, { name: string; currentTotal: number; previousTotal: number }> = {}
      for (const l of targetLearners) {
        const curTotal = currentMarks.filter(m => m.learner_id === l.id && m.score !== null).reduce((a, m) => a + (m.score || 0), 0)
        const prevTotal = previousMarks.filter(m => m.learner_id === l.id && m.score !== null).reduce((a, m) => a + (m.score || 0), 0)
        learnerTotals[l.id] = { name: l.name, currentTotal: curTotal, previousTotal: prevTotal }
      }

      // Rank current and previous
      const curRanked = Object.entries(learnerTotals).sort((a, b) => b[1].currentTotal - a[1].currentTotal)
      const prevRanked = Object.entries(learnerTotals).sort((a, b) => b[1].previousTotal - a[1].previousTotal)

      const learnerComparisons = Object.entries(learnerTotals)
        .filter(([, v]) => v.currentTotal > 0 || v.previousTotal > 0)
        .map(([id, v]) => ({
          name: v.name,
          currentTotal: v.currentTotal,
          previousTotal: v.previousTotal,
          change: v.currentTotal - v.previousTotal,
          currentRank: curRanked.findIndex(([lid]) => lid === id) + 1,
          previousRank: prevRanked.findIndex(([lid]) => lid === id) + 1,
        }))

      const topImprovers = [...learnerComparisons].filter(l => l.previousTotal > 0).sort((a, b) => b.change - a.change).slice(0, 3)
      const topDroppers = [...learnerComparisons].filter(l => l.previousTotal > 0).sort((a, b) => a.change - b.change).slice(0, 3)

      const curClassTotal = learnerComparisons.filter(l => l.currentTotal > 0)
      const prevClassTotal = learnerComparisons.filter(l => l.previousTotal > 0)
      const currentClassAvgVal = curClassTotal.length > 0 ? Math.round((curClassTotal.reduce((a, b) => a + b.currentTotal, 0) / curClassTotal.length) * 10) / 10 : 0
      const previousClassAvgVal = prevClassTotal.length > 0 ? Math.round((prevClassTotal.reduce((a, b) => a + b.previousTotal, 0) / prevClassTotal.length) * 10) / 10 : 0

      console.log('[v0] Comparison data prepared:', { topImprovers: topImprovers.length, topDroppers: topDroppers.length })

      setComparisonData({
        currentSession: { name: currentSessionForComparison.exam_types?.name || '', term: currentSessionForComparison.term, year: currentSessionForComparison.year },
        previousSession: { name: previousSession.exam_types?.name || '', term: previousSession.term, year: previousSession.year },
        subjectComparisons,
        topImprovers,
        topDroppers,
        currentClassAvg: currentClassAvgVal,
        previousClassAvg: previousClassAvgVal,
        learnerComparisons: learnerComparisons.sort((a, b) => b.change - a.change),
      })
    } catch (err) {
      console.error('[v0] Comparison error:', err)
    } finally {
      setIsLoadingComparison(false)
    }
  }, [selectedSession, currentClass, comparisonSessionId])

  // Auto-fetch comparison when session is selected or class changes
  useEffect(() => {
    if (selectedSession) {
      const classToCompare = comparisonClassId || currentClass?.id
      if (classToCompare) {
        console.log('[v0] Fetching comparison for class:', classToCompare)
        fetchExamComparison(comparisonClassId || undefined)
      }
    }
  }, [selectedSession, fetchExamComparison, comparisonClassId])

  // Fetch all classes for stream comparison and admin dropdown
  useEffect(() => {
    if (!currentSchool?.id) return
    const supabase = createClient()
    supabase.from('classes').select('id, name').eq('school_id', currentSchool?.id).order('display_order').then(({ data }) => {
      setAllClasses(sortClassesByLevel(data || []))
    })
  }, [currentSchool?.id])

  // Fetch learners with marks and calculate results
  useEffect(() => {
    if (!selectedSession || !subjects || subjects.length === 0) {
      setResults([])
      return
    }

    if (marks.length === 0) {
      setResults([])
      return
    }

    const supabase = createClient()
    
    // Get unique learner IDs from marks for this session
    const marksArray = Array.isArray(marks) ? marks : []
    const learnerIdsInSession = new Set(marksArray.map(m => m.learner_id))
    
    if (learnerIdsInSession.size === 0) {
      setResults([])
      return
    }

    supabase
      .from('learners')
      .select('*')
      .in('id', Array.from(learnerIdsInSession))
      .then(({ data: sessionLearners, error }) => {
        if (error) {
          console.error('[v0] Error fetching learners:', error)
          setResults([])
          return
        }

        const results: LearnerResult[] = (sessionLearners || [])
          .map((learner) => {
            const learnerMarks: Record<string, number | null> = {}
            let total = 0
            let subjectsWithMarks = 0

            subjects.forEach((subject) => {
              const mark = marksArray.find((m) => m.learner_id === learner.id && m.subject_id === subject.id)
              learnerMarks[subject.id] = mark?.score ?? null
              if (mark?.score !== null && mark?.score !== undefined) {
                total += mark.score
                subjectsWithMarks++
              }
            })

            const average = subjectsWithMarks > 0 ? total / subjectsWithMarks : 0

            return {
              learner,
              marks: learnerMarks,
              total,
              average,
              rank: 0,
            }
          })
          .filter((result) => Object.values(result.marks).some((m) => m !== null))
          .sort((a, b) => b.total - a.total)
          .map((result, index, arr) => {
            if (index === 0) {
              result.rank = 1
            } else if (result.total === arr[index - 1].total) {
              result.rank = arr[index - 1].rank
            } else {
              result.rank = index + 1
            }
            
            // Set overall_rank and total_in_grade
            const className = currentClass?.name || ''
            if (className.includes(' ')) {
              result.total_in_grade = arr.length
            } else {
              result.total_in_grade = arr.length
            }
            result.overall_rank = result.rank
            
            return result
          })

        setResults(results)
      })
      .catch((err) => {
        console.error('[v0] Unexpected error fetching learners:', err)
        setResults([])
      })
  }, [selectedSession?.id, marks.length, subjects.length, currentClass?.name])

  const subjectPerformance = subjects
  .map((subject) => {
    const subjectScores = results
      .map((r) => r.marks[subject.id])
      .filter((m) => m !== null && m !== undefined) as number[]
    const mean = subjectScores.length > 0 ? subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length : 0
    const highest = subjectScores.length > 0 ? Math.max(...subjectScores) : 0
    const lowest = subjectScores.length > 0 ? Math.min(...subjectScores) : 0
    
    // Calculate grade distribution
    const gradeA = subjectScores.filter(s => s >= 80).length
    const gradeB = subjectScores.filter(s => s >= 60 && s < 80).length
    const gradeC = subjectScores.filter(s => s >= 40 && s < 60).length
    const gradeD = subjectScores.filter(s => s >= 30 && s < 40).length
    const gradeE = subjectScores.filter(s => s < 30).length
    
    // Calculate standard deviation
    const variance = subjectScores.length > 0 
      ? subjectScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / subjectScores.length 
      : 0
    const stdDev = Math.sqrt(variance)
    
    // Find top performer
    const topPerformerIdx = subjectScores.indexOf(highest)
    const topPerformer = topPerformerIdx !== -1 ? results.find(r => r.marks[subject.id] === highest)?.learner.name : '-'
    
    return {
      name: subject.name,
      mean: mean.toFixed(1),
      meanValue: mean,
      highest,
      lowest,
      count: subjectScores.length,
      gradeA,
      gradeB,
      gradeC,
      gradeD,
      gradeE,
      stdDev: stdDev.toFixed(1),
      passRate: subjectScores.length > 0 ? ((subjectScores.filter(s => s >= 50).length / subjectScores.length) * 100).toFixed(1) : '0',
      topPerformer: topPerformer || '-',
      topPerformerScore: highest,
    }
  })
  .sort((a, b) => parseFloat(b.mean) - parseFloat(a.mean))

// Calculate additional class statistics
const classAverage = results.length > 0 ? (results.reduce((sum, r) => sum + r.average, 0) / results.length).toFixed(1) : '0'
const classAverageRounded = Math.round(parseFloat(classAverage))
const classAveragePerformanceLevel = getGradeLevelByClass(classAverageRounded, currentClass?.name, currentSchool?.name)
const totalScores = results.map(r => r.total)
const classMedian = totalScores.length > 0 ? totalScores.sort((a, b) => a - b)[Math.floor(totalScores.length / 2)] : 0
const classPassRate = results.length > 0 ? ((results.filter(r => r.average >= 50).length / results.length) * 100).toFixed(1) : '0'
const topPerformers = results.slice(0, 5)
const bottomPerformers = [...results].sort((a, b) => a.total - b.total).slice(0, 5)
const classGradeA = results.filter(r => r.average >= 80).length
const classGradeB = results.filter(r => r.average >= 60 && r.average < 80).length
const classGradeC = results.filter(r => r.average >= 50 && r.average < 60).length
const classGradeD = results.filter(r => r.average >= 30 && r.average < 40).length
  const classGradeE = results.filter(r => r.average < 30).length
  const maleStudents = results.filter(r => r.learner.gender === 'Male' || r.learner.gender === 'male' || r.learner.gender === 'M')
  const femaleStudents = results.filter(r => r.learner.gender === 'Female' || r.learner.gender === 'female' || r.learner.gender === 'F')
  const maleAverage = maleStudents.length > 0 ? (maleStudents.reduce((sum, r) => sum + r.average, 0) / maleStudents.length).toFixed(1) : '0'
  const femaleAverage = femaleStudents.length > 0 ? (femaleStudents.reduce((sum, r) => sum + r.average, 0) / femaleStudents.length).toFixed(1) : '0'

  const handleDownloadCSV = () => {
    const headers = ['No.', 'Name', ...subjects.map((s) => s.name), 'Total', 'Average']
    const rows = results.map((result, idx) => [
      (idx + 1).toString(),
      result.learner.name,
      ...subjects.map((s) => result.marks[s.id] ?? ''),
      result.total.toString(),
      result.average.toFixed(1),
    ])
    
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    // Create filename: Grade_9_Term_1_Opener (or similar)
    const gradeName = currentClass?.name || 'Grade'
    const examType = selectedSession?.exam_types?.name || 'Session'
    const term = selectedSession?.term || 'Term'
    const filename = `${gradeName}_${term}_${examType}.csv`
    
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handlePrint = () => {
    const gradeName = currentClass?.name || 'Grade'
    const examType = selectedSession?.exam_types?.name || 'Exam'
    const term = selectedSession?.term || 'Term'
    const year = selectedSession?.year || ''
    const filename = `${gradeName}_${term}_${year}_Marklist`
    
    // Create a new window with just the marklist content
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print the marklist')
      return
    }
    
    // Build subject headers (two rows: subject name spanning 3 columns, then MKS/LVL/PTS)
    const subjectHeadersRow1 = subjects.map(s => 
      `<th colSpan="3" style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; background: #e5e7eb;">${getSubjectDisplay(s.name).toUpperCase()}</th>`
    ).join('')
    
    const subjectHeadersRow2 = subjects.map(s => 
      `<th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 8px; background: #e5e7eb;">MKS</th>
       <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 8px; background: #e5e7eb; color: #1a3a52;">LVL</th>
       <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 8px; background: #e5e7eb; color: #d97706;">PTS</th>`
    ).join('')
    
    // Build student rows
    const studentRows = results.map((result, idx) => {
      const subjectCells = subjects.map(subject => {
        const score = result.marks[subject.id]
        const performanceLevel = getGradeLevelByClass(score, currentClass?.name, currentSchool?.name)
        return `<td style="border: 1px solid #333; padding: 3px; text-align: center; font-size: 9px;">${score ?? '-'}</td>
                <td style="border: 1px solid #333; padding: 3px; text-align: center; font-size: 9px; font-weight: bold; color: #1a3a52;">${performanceLevel ? performanceLevel.level : '-'}</td>
                <td style="border: 1px solid #333; padding: 3px; text-align: center; font-size: 8px; color: #d97706; font-weight: bold;">${performanceLevel ? performanceLevel.points : '-'}</td>`
      }).join('')
      
      const avgPerformanceLevel = getGradeLevelByClass(Math.round(result.average), currentClass?.name, currentSchool?.name)
      return `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f3f4f6'};">
        <td style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px;">${idx + 1}</td>
        <td style="border: 1px solid #333; padding: 4px; text-align: left; font-size: 9px; font-weight: 500;">${result.learner.name}</td>
        ${subjectCells}
        <td style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; font-weight: bold;">${result.total}</td>
        <td style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; font-weight: bold; color: #1a3a52;">${avgPerformanceLevel ? avgPerformanceLevel.level : '-'}</td>
      </tr>`
    }).join('')
    
    // Build mean row
    const meanCells = subjects.map(subject => {
      const subjectScores = results.map(r => r.marks[subject.id]).filter((s): s is number => s !== null && s !== undefined)
      const meanScore = subjectScores.length > 0 ? (subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length).toFixed(1) : '-'
      const mean = subjectScores.length > 0 ? Math.round(subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length) : null
      const meanPerformance = getGradeLevelByClass(mean, currentClass?.name, currentSchool?.name)
      return `<td style="border: 1px solid #333; padding: 3px; text-align: center; font-size: 8px; font-weight: bold; background: #e5e7eb;">${meanScore}</td>
              <td style="border: 1px solid #333; padding: 3px; text-align: center; font-size: 8px; font-weight: bold; background: #e5e7eb; color: #1a3a52;">${meanPerformance ? meanPerformance.level : '-'}</td>
              <td style="border: 1px solid #333; padding: 3px; text-align: center; font-size: 8px; background: #e5e7eb; color: #d97706; font-weight: bold;">${meanPerformance ? meanPerformance.points : '-'}</td>`
    }).join('')
    
    const marklistContent = `
      <html>
      <head>
        <title>${filename}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
          body { padding: 5px; background: white; line-height: 1; }
          table { border-collapse: collapse; width: 100%; }
          tbody tr { page-break-inside: avoid; orphans: 1; widows: 1; }
          @media print { 
            body { padding: 3px; margin: 0; }
            @page { size: landscape; margin: 2mm; padding: 0; }
            html, body { height: auto; margin: 0; padding: 0; }
            table { page-break-inside: auto; }
            tbody tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 3px;">
          <h1 style="font-size: 13px; font-weight: bold; margin: 0 0 2px 0; padding: 0;">${currentSchool?.name || 'School'.toUpperCase()}</h1>
          <p style="font-size: 10px; font-weight: bold; margin: 0 0 1px 0; padding: 0;">${gradeName} - ${examType} - ${term} ${year}</p>
          <p style="font-size: 8px; color: #666; margin: 0; padding: 0;">Teacher: ${teacherName || 'N/A'} | Date: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #333;">
          <thead>
            <tr style="background: #e5e7eb;">
              <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; width: 30px;">No.</th>
              <th style="border: 1px solid #333; padding: 4px; text-align: left; font-size: 9px; min-width: 100px;">Name</th>
              ${subjectHeadersRow1}
              <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; background: #e5e7eb;">Total</th>
              <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; background: #e5e7eb;">Avg</th>
            </tr>
            <tr style="background: #e5e7eb;">
              <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 8px;"></th>
              <th style="border: 1px solid #333; padding: 4px; text-align: left; font-size: 8px;"></th>
              ${subjectHeadersRow2}
              <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 8px;"></th>
              <th style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 8px;"></th>
            </tr>
          </thead>
          <tbody>
            ${studentRows}
            <tr style="background: #e5e7eb; font-weight: bold;">
              <td colspan="2" style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px;">MEAN</td>
              ${meanCells}
              <td style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px;"></td>
              <td style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9px; color: #1a3a52;">${classAveragePerformanceLevel ? classAveragePerformanceLevel.level : '-'}</td>
            </tr>
          </tbody>
        </table>
        
      </body>
      </html>
    `
    
    printWindow.document.write(marklistContent)
    printWindow.document.close()
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  const downloadFullLearnerComparison = () => {
    if (!comparisonData) {
      alert('No comparison data available')
      return
    }

    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Please allow popups to download the comparison')
        return
      }

      const gradeName = currentClass?.name || 'Grade'
      const examType = selectedSession?.exam_types?.name || 'Session'
      const term = selectedSession?.term || 'Term'
      const year = selectedSession?.year || ''

      const reportContent = `
        <html>
        <head>
          <title>${gradeName}_Full_Learner_Comparison</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { padding: 20px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 14px; margin-bottom: 5px; }
            .info { text-align: center; font-size: 12px; margin-bottom: 15px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #333; padding: 8px; }
            th { background-color: #e8e8e8; font-weight: bold; text-align: center; }
            td { padding: 6px 8px; }
            td:first-child { text-align: left; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .positive { color: #00aa00; font-weight: bold; }
            .negative { color: #dd0000; font-weight: bold; }
            .neutral { color: #666; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>${currentSchool?.name || 'School'}</h1>
          <h2>FULL LEARNER COMPARISON</h2>
          <div class="info">
            ${gradeName} | ${examType} - Term ${term} ${year} | Generated: ${new Date().toLocaleDateString()}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prev Total</th>
                <th>Prev Rank</th>
                <th>Curr Total</th>
                <th>Curr Rank</th>
                <th>Marks Change</th>
                <th>Rank Change</th>
              </tr>
            </thead>
            <tbody>
              ${comparisonData.learnerComparisons.map(l => {
                const rankChange = l.previousRank - l.currentRank
                const changeClass = l.change > 0 ? 'positive' : l.change < 0 ? 'negative' : 'neutral'
                const rankChangeClass = rankChange > 0 ? 'positive' : rankChange < 0 ? 'negative' : 'neutral'
                return `
                  <tr>
                    <td>${l.name}</td>
                    <td style="text-align: center;">${l.previousTotal || '-'}</td>
                    <td style="text-align: center;">${l.previousTotal > 0 ? l.previousRank : '-'}</td>
                    <td style="text-align: center;">${l.currentTotal || '-'}</td>
                    <td style="text-align: center;">${l.currentTotal > 0 ? l.currentRank : '-'}</td>
                    <td style="text-align: center;" class="${changeClass}">${l.change > 0 ? '+' : ''}${l.change}</td>
                    <td style="text-align: center;" class="${rankChangeClass}">${l.previousTotal > 0 && l.currentTotal > 0 ? (rankChange > 0 ? '+' : '') + rankChange : '-'}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `

      printWindow.document.write(reportContent)
      printWindow.document.close()
      printWindow.print()
    } catch (error) {
      console.error('Error downloading learner comparison:', error)
      alert('Failed to download comparison. Please try again.')
    }
  }

  const handleDownloadReport = (reportType: 'class' | 'subject' | 'comparison') => {
    const gradeName = currentClass?.name || 'Grade'
    const examType = selectedSession?.exam_types?.name || 'Session'
    const term = selectedSession?.term || 'Term'
    const year = selectedSession?.year || ''
    const filename = `${gradeName}_${term}_${examType}_${reportType === 'class' ? 'Class_Analysis' : reportType === 'subject' ? 'Subject_Analysis' : 'Exam_Comparison'}`
    
    // Create a new window with just the report content
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to download the report')
      return
    }
    
    let reportContent = ''
    
    if (reportType === 'comparison' && comparisonData) {
      reportContent = `
        <html>
        <head>
          <title>${filename}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { padding: 20px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 14px; margin-bottom: 5px; }
            .info { text-align: center; font-size: 12px; margin-bottom: 15px; color: #555; }
            h3 { font-size: 13px; margin: 15px 0 8px; border-bottom: 1px solid #333; padding-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
            th, td { border: 1px solid #333; padding: 6px 8px; }
            th { background-color: #e8e8e8; font-weight: bold; }
            .header-box { background: #f0f8ff; border: 2px solid #333; padding: 12px; margin-bottom: 15px; }
            .comparison-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 15px; align-items: center; margin-bottom: 10px; }
            .exam-col { border: 1px solid #ccc; padding: 10px; }
            .vs-col { text-align: center; font-weight: bold; font-size: 14px; }
            .trend-up { color: #00aa00; font-weight: bold; }
            .trend-down { color: #dd0000; font-weight: bold; }
            .trend-neutral { color: #666; font-weight: bold; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>${currentSchool?.name || 'School'.toUpperCase()}</h1>
          <h2>EXAM COMPARISON REPORT</h2>
          <div class="info">
            ${currentClass?.name} | Generated: ${new Date().toLocaleDateString()}
          </div>
          
          <div class="header-box">
            <div class="comparison-row">
              <div class="exam-col">
                <strong>${comparisonData.previousSession?.name}</strong><br/>
                Term ${comparisonData.previousSession?.term} ${comparisonData.previousSession?.year}<br/>
                <strong>Class Mean: ${comparisonData.previousClassAvg}</strong>
              </div>
              <div class="vs-col">VS</div>
              <div class="exam-col">
                <strong>${comparisonData.currentSession?.name}</strong><br/>
                Term ${comparisonData.currentSession?.term} ${comparisonData.currentSession?.year}<br/>
                <strong>Class Mean: ${comparisonData.currentClassAvg}</strong>
              </div>
            </div>
            <div style="text-align: center; margin-top: 8px;">
              <span class="${(comparisonData.currentClassAvg - comparisonData.previousClassAvg) > 0 ? 'trend-up' : (comparisonData.currentClassAvg - comparisonData.previousClassAvg) < 0 ? 'trend-down' : 'trend-neutral'}">
                Change: ${(comparisonData.currentClassAvg - comparisonData.previousClassAvg) > 0 ? '+' : ''}${(comparisonData.currentClassAvg - comparisonData.previousClassAvg).toFixed(1)}
              </span>
            </div>
          </div>
          
          <h3>Subject Performance Comparison</h3>
          <table>
            <tr>
              <th>Subject</th>
              <th>${comparisonData.previousSession?.name} Mean</th>
              <th>${comparisonData.currentSession?.name} Mean</th>
              <th>Change</th>
              <th>Trend</th>
            </tr>
            ${comparisonData.subjectComparisons.map(s => `
              <tr>
                <td>${s.name}</td>
                <td style="text-align:center">${s.previousMean}</td>
                <td style="text-align:center">${s.currentMean}</td>
                <td style="text-align:center ${s.change > 0 ? ';color:#00aa00' : s.change < 0 ? ';color:#dd0000' : ''}">${s.change > 0 ? '+' : ''}${s.change}</td>
                <td style="text-align:center" class="${s.change > 0 ? 'trend-up' : s.change < 0 ? 'trend-down' : 'trend-neutral'}">${s.change > 0 ? '📈 Improved' : s.change < 0 ? '📉 Declined' : '— No Change'}</td>
              </tr>
            `).join('')}
          </table>
          
          <h3>Most Improved</h3>
          <table>
            <tr><th>Rank</th><th>Name</th><th>${comparisonData.previousSession?.name} Total</th><th>${comparisonData.currentSession?.name} Total</th><th>Improvement</th></tr>
            ${comparisonData.topImprovers.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${s.name}</td>
                <td style="text-align:center">${s.previousTotal}</td>
                <td style="text-align:center">${s.currentTotal}</td>
                <td style="text-align:center; color: #00aa00; font-weight: bold;">+${s.change}</td>
              </tr>
            `).join('')}
          </table>
          
          <h3>Most Dropped</h3>
          <table>
            <tr><th>Rank</th><th>Name</th><th>${comparisonData.previousSession?.name} Total</th><th>${comparisonData.currentSession?.name} Total</th><th>Decline</th></tr>
            ${comparisonData.topDroppers.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${s.name}</td>
                <td style="text-align:center">${s.previousTotal}</td>
                <td style="text-align:center">${s.currentTotal}</td>
                <td style="text-align:center; color: #dd0000; font-weight: bold;">${s.change}</td>
              </tr>
            `).join('')}
          </table>
        </body>
        </html>
      `
    } else if (reportType === 'class') {
      reportContent = `
        <html>
        <head>
          <title>${filename}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { padding: 20px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 14px; margin-bottom: 5px; }
            .info { text-align: center; font-size: 12px; margin-bottom: 15px; color: #555; }
            h3 { font-size: 13px; margin: 15px 0 8px; border-bottom: 1px solid #333; padding-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
            th, td { border: 1px solid #333; padding: 6px 8px; }
            th { background-color: #e8e8e8; font-weight: bold; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
            .stat-box { border: 1px solid #ccc; padding: 10px; text-align: center; background: #f9f9f9; }
            .stat-label { font-size: 10px; color: #666; }
            .stat-value { font-size: 18px; font-weight: bold; color: #333; }
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>${currentSchool?.name || 'School'.toUpperCase()}</h1>
          <h2>CLASS PERFORMANCE ANALYSIS</h2>
          <div class="info">
            ${currentClass?.name} | ${examType} - ${term} ${year}<br/>
            Teacher In Charge: ${teacherName || 'N/A'} | Generated: ${new Date().toLocaleDateString()}
          </div>
          
          <h3>Summary Statistics</h3>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-label">Total Students</div><div class="stat-value">${results.length}</div></div>
            <div class="stat-box"><div class="stat-label">Class Average</div><div class="stat-value">${classAverage}</div></div>
            <div class="stat-box"><div class="stat-label">Class Median</div><div class="stat-value">${classMedian}</div></div>
            <div class="stat-box"><div class="stat-label">Highest Total</div><div class="stat-value">${results.length > 0 ? Math.max(...results.map(r => r.total)) : 0}</div></div>
            <div class="stat-box"><div class="stat-label">Lowest Total</div><div class="stat-value">${results.length > 0 ? Math.min(...results.map(r => r.total)) : 0}</div></div>
            <div class="stat-box"><div class="stat-label">Pass Rate</div><div class="stat-value">${classPassRate}%</div></div>
          </div>
          
          <h3>Grade Distribution</h3>
          <table>
            <tr><th>Grade</th><th>Count</th><th>Percentage</th></tr>
            <tr><td>A (80-100%)</td><td style="text-align:center">${classGradeA}</td><td style="text-align:center">${results.length > 0 ? ((classGradeA/results.length)*100).toFixed(1) : 0}%</td></tr>
            <tr><td>B (60-79%)</td><td style="text-align:center">${classGradeB}</td><td style="text-align:center">${results.length > 0 ? ((classGradeB/results.length)*100).toFixed(1) : 0}%</td></tr>
            <tr><td>C (40-59%)</td><td style="text-align:center">${classGradeC}</td><td style="text-align:center">${results.length > 0 ? ((classGradeC/results.length)*100).toFixed(1) : 0}%</td></tr>
            <tr><td>D (30-39%)</td><td style="text-align:center">${classGradeD}</td><td style="text-align:center">${results.length > 0 ? ((classGradeD/results.length)*100).toFixed(1) : 0}%</td></tr>
            <tr><td>E (Below 30%)</td><td style="text-align:center">${classGradeE}</td><td style="text-align:center">${results.length > 0 ? ((classGradeE/results.length)*100).toFixed(1) : 0}%</td></tr>
          </table>
          
          <h3>Gender Analysis</h3>
          <table>
            <tr><th>Gender</th><th>Count</th><th>Average</th></tr>
            <tr><td>Male</td><td style="text-align:center">${maleStudents.length}</td><td style="text-align:center">${maleAverage}</td></tr>
            <tr><td>Female</td><td style="text-align:center">${femaleStudents.length}</td><td style="text-align:center">${femaleAverage}</td></tr>
          </table>
          
          <div class="two-col">
            <div>
              <h3>Top 5 Performers</h3>
              <table>
                <tr><th>Rank</th><th>Name</th><th>Total</th><th>Avg</th></tr>
                ${topPerformers.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${r.learner.name}</td><td style="text-align:center">${r.total}</td><td style="text-align:center">${r.average.toFixed(1)}</td></tr>`).join('')}
              </table>
            </div>
            <div>
              <h3>Bottom 5 Performers</h3>
              <table>
                <tr><th>Rank</th><th>Name</th><th>Total</th><th>Avg</th></tr>
                ${bottomPerformers.map((r, i) => `<tr><td style="text-align:center">${results.length - 4 + i}</td><td>${r.learner.name}</td><td style="text-align:center">${r.total}</td><td style="text-align:center">${r.average.toFixed(1)}</td></tr>`).join('')}
              </table>
            </div>
          </div>
        </body>
        </html>
      `
    } else {
      reportContent = `
        <html>
        <head>
          <title>${filename}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { padding: 20px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 14px; margin-bottom: 5px; }
            .info { text-align: center; font-size: 12px; margin-bottom: 15px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #333; padding: 5px; }
            th { background-color: #e8e8e8; font-weight: bold; }
            .mean { font-weight: bold; color: #0066cc; }
            .pass-high { background: #d4edda; }
            .pass-mid { background: #fff3cd; }
            .pass-low { background: #f8d7da; }
            @media print { body { padding: 10px; } @page { size: landscape; } }
          </style>
        </head>
        <body>
          <h1>${currentSchool?.name || 'School'.toUpperCase()}</h1>
          <h2>SUBJECT PERFORMANCE ANALYSIS</h2>
          <div class="info">
            ${currentClass?.name} | ${examType} - ${term} ${year}<br/>
            Teacher In Charge: ${teacherName || 'N/A'} | Generated: ${new Date().toLocaleDateString()}
          </div>
          
          <table>
            <tr>
              <th>Rank</th>
              <th>Subject</th>
              <th>Mean</th>
              <th>Highest</th>
              <th>Lowest</th>
              <th>Std Dev</th>
              <th>Pass Rate</th>
              <th>A</th>
              <th>B</th>
              <th>C</th>
              <th>D</th>
              <th>E</th>
              <th>Top Performer</th>
            </tr>
            ${subjectPerformance.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${s.name}</td>
                <td class="mean" style="text-align:center">${s.mean}</td>
                <td style="text-align:center">${s.highest}</td>
                <td style="text-align:center">${s.lowest}</td>
                <td style="text-align:center">${s.stdDev}</td>
                <td style="text-align:center" class="${parseFloat(s.passRate) >= 70 ? 'pass-high' : parseFloat(s.passRate) >= 50 ? 'pass-mid' : 'pass-low'}">${s.passRate}%</td>
                <td style="text-align:center">${s.gradeA}</td>
                <td style="text-align:center">${s.gradeB}</td>
                <td style="text-align:center">${s.gradeC}</td>
                <td style="text-align:center">${s.gradeD}</td>
                <td style="text-align:center">${s.gradeE}</td>
                <td>${s.topPerformer}</td>
              </tr>
            `).join('')}
          </table>
        </body>
        </html>
      `
    }
    
    printWindow.document.write(reportContent)
    printWindow.document.close()
    
    // Trigger print dialog for PDF download
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  // Determine page orientation based on number of subjects
  const pageOrientation = subjects.length > 8 ? 'landscape' : 'portrait'

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading marklist...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            line-height: 1;
          }
          html, body {
            width: 100%;
            height: 100%;
            background: white;
          }
          body > * {
            display: none;
          }
          header {
            display: none !important;
          }
          nav {
            display: none !important;
          }
          .print-header {
            display: none !important;
          }
          .print-title {
            display: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .space-y-6 > div:not(#print-area) {
            display: none !important;
          }
          #print-area {
            display: block;
            position: static;
            width: 100%;
            background: white;
            margin: 0;
            padding: 0.2cm;
            visibility: visible;
          }
          @page {
            size: landscape;
            margin: 0.3cm 0.2cm;
          }
          .marklist-title {
            text-align: center;
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 0.05cm;
          }
          .marklist-subtitle {
            text-align: center;
            font-size: 8pt;
            margin-bottom: 0.1cm;
            line-height: 1.1;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7pt;
            border: 1pt solid #000;
          }
          thead {
            background-color: #e8e8e8;
          }
          th {
            border: 0.5pt solid #000;
            padding: 1pt 1pt;
            text-align: center;
            font-weight: bold;
            font-size: 7pt;
            line-height: 1;
          }
          td {
            border: 0.5pt solid #000;
            padding: 1pt 1pt;
            text-align: center;
            font-size: 7pt;
            line-height: 1;
          }
          .name-cell {
            text-align: left;
            padding-left: 2pt;
          }
          tbody tr:nth-child(even) {
            background-color: #f5f5f5;
          }
          tbody tr {
            height: auto;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Non-print content */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Marklist</h2>
            <p className="text-xs text-gray-600 mt-0.5">View and export results for {currentClass?.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleDownloadCSV}
              disabled={results.length === 0}
              className="bg-blue-500 text-white hover:bg-blue-600 h-9 text-xs sm:text-sm"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button onClick={handlePrint} disabled={results.length === 0} className="bg-blue-500 text-white hover:bg-blue-600 h-9 text-xs sm:text-sm">
              <Printer className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Print Marklist</span>
            </Button>
            {currentSchool?.feature_report_cards && (
              <Button 
                onClick={async () => {
                  console.log('[v0] === PRINT REPORTS STARTED ===')
                  console.log('[v0] School:', currentSchool?.name, 'ID:', currentSchool?.id)
                  console.log('[v0] Class:', currentClass?.name, 'ID:', currentClass?.id)
                  console.log('[v0] Session:', selectedSession?.term, selectedSession?.year, 'Exam Type ID:', selectedSession?.exam_type_id)
                  console.log('[v0] Current results count:', results.length)
                  console.log('[v0] School Logo URL:', currentSchool?.logo_url)
                  
                  let finalResults = [...results]
                  const className = currentClass?.name || ''
                  const classWords = className.trim().split(/\s+/)
                  const isStreamedClass = classWords.length > 2
                  
                  console.log('[v0] Class analysis - Words:', classWords, 'IsStreamed:', isStreamedClass)
                  
                  // STEP 1: For streamed classes, calculate overall rank across all streams
                  if (isStreamedClass && selectedSessionId && currentSchool) {
                    console.log('[v0] ✓ Processing STREAMED class')
                    
                    try {
                      const supabase = createClient()
                      const gradeLevel = classWords.slice(0, -1).join(' ') // e.g., "Grade 7"
                      
                      console.log('[v0] Grade level extracted:', gradeLevel)
                      
                      // Get all stream classes for this grade
                      const { data: allStreamClasses, error: streamError } = await supabase
                        .from('classes')
                        .select('id, name')
                        .eq('school_id', currentSchool.id)
                        .ilike('name', `${gradeLevel} %`)
                      
                      if (streamError) throw streamError
                      
                      console.log('[v0] All matching classes for grade:', allStreamClasses?.map(c => ({ name: c.name, id: c.id })))
                      
                      // Filter to only actual streams (3+ words)
                      const streamClassIds = (allStreamClasses || [])
                        .filter(c => {
                          const words = c.name.trim().split(/\s+/)
                          const isStream = words.length > 2
                          console.log('[v0]   - Class:', c.name, 'Words:', words.length, 'IsStream:', isStream)
                          return isStream
                        })
                        .map(c => c.id)
                      
                      console.log('[v0] Stream class IDs to use:', streamClassIds)
                      
                      if (streamClassIds.length > 0) {
                        try {
                          // Get ALL learners across all streams
                          const { data: allLearners, error: learnersError } = await supabase
                            .from('learners')
                            .select('id, name, class_id')
                            .in('class_id', streamClassIds)
                          
                          if (learnersError) throw learnersError
                          
                          console.log('[v0] All learners in streams:', allLearners?.length, 'Sample:', allLearners?.slice(0, 3).map(l => ({ name: l.name, class_id: l.class_id })))
                          
                          const allLearnerIds = (allLearners || []).map(l => l.id)
                          
                          if (allLearnerIds.length > 0) {
                            // Get marks for all learners for this exam
                            const { data: allMarks, error: marksError } = await supabase
                              .from('marks')
                              .select('learner_id, score')
                              .in('learner_id', allLearnerIds)
                              .eq('year', selectedSession?.year)
                              .eq('term', selectedSession?.term)
                              .eq('exam_type_id', selectedSession?.exam_type_id)
                            
                            if (marksError) throw marksError
                            
                            console.log('[v0] Marks fetched:', allMarks?.length, 'Type:', typeof allMarks, 'IsArray:', Array.isArray(allMarks), 'First 5:', allMarks?.slice(0, 5))
                            
                            if (!Array.isArray(allMarks)) {
                              console.log('[v0] ✗ allMarks is not an array:', allMarks)
                              throw new Error('allMarks is not an array')
                            }
                            
                            // Calculate totals per learner
                            const learnerTotals: Record<string, number> = {}
                            
                            for (let i = 0; i < allMarks.length; i++) {
                              const m = allMarks[i]
                              try {
                                if (m && m.learner_id && m.score !== undefined) {
                                  if (!learnerTotals[m.learner_id]) learnerTotals[m.learner_id] = 0
                                  if (m.score !== null) learnerTotals[m.learner_id] += Number(m.score) || 0
                                }
                              } catch (markErr) {
                                console.error('[v0] Error processing mark at index', i, ':', m, 'Error:', markErr)
                              }
                            }
                            
                            console.log('[v0] Learner totals calculated:', Object.keys(learnerTotals).length, 'Sample:', Object.entries(learnerTotals).slice(0, 5))
                            
                            // Create ranked list
                            const rankedLearners = Object.entries(learnerTotals)
                              .sort(([, a], [, b]) => (b as any) - (a as any))
                              .map(([id, total], index) => ({ id, total, rank: index + 1 }))
                            
                            console.log('[v0] Top 5 ranked learners:', rankedLearners.slice(0, 5))
                            
                            // Update results with overall rank and total
                            finalResults = results.map((r, idx) => {
                              const ranked = rankedLearners.find(rl => rl.id === r.learner.id)
                              const updated = {
                                ...r,
                                overall_rank: ranked?.rank || r.rank,
                                total_in_grade: allLearnerIds.length
                              }
                              if (idx < 3) {
                                console.log('[v0] Result', idx, ':', r.learner.name, '-> StreamRank:', r.rank, 'OverallRank:', updated.overall_rank, 'TotalInGrade:', updated.total_in_grade, 'Found:', !!ranked)
                              }
                              return updated
                            })
                          } else {
                            console.log('[v0] ⚠ No learners found in streams')
                          }
                        } catch (innerErr) {
                          console.error('[v0] ✗ Inner streamed class error:', innerErr)
                        }
                      } else {
                        console.log('[v0] ⚠ No stream classes found (all classes have ≤2 words)')
                      }
                    } catch (err) {
                      console.error('[v0] ✗ Overall rank error:', err)
                    }
                  } else {
                    console.log('[v0] ✓ Processing NON-STREAMED class')
                    // For non-streamed classes, also set overall_rank and total_in_grade
                    finalResults = results.map(r => ({
                      ...r,
                      overall_rank: r.overall_rank || r.rank,
                      total_in_grade: r.total_in_grade || results.length
                    }))
                  }
                  
                  console.log('[v0] Final results - Count:', finalResults.length, 'Sample:', finalResults.slice(0, 2).map(r => ({
                    name: r.learner.name,
                    streamRank: r.rank,
                    overallRank: r.overall_rank,
                    totalInGrade: r.total_in_grade
                  })))
                  
                  // STEP 2: Fetch term history for trend graph
                  const termHistory: Record<string, any[]> = {}
                  
                  try {
                    const supabase = createClient()
                    const learnerIds = finalResults.map(r => r.learner.id)
                    
                    if (learnerIds.length > 0) {
                      try {
                        // Get ALL marks across all terms and exams for these learners
                        const { data: historyMarks, error: historyError } = await supabase
                          .from('marks')
                          .select(`
                            learner_id,
                            score,
                            year,
                            term,
                            exam_type_id,
                            exam_types(name)
                          `)
                          .in('learner_id', learnerIds)
                        
                        if (historyError) throw historyError
                        
                        console.log('[v0] History marks fetched:', historyMarks?.length, 'Type:', typeof historyMarks, 'IsArray:', Array.isArray(historyMarks))
                        
                        if (!Array.isArray(historyMarks)) {
                          console.log('[v0] ✗ historyMarks is not an array:', historyMarks)
                          throw new Error('historyMarks is not an array')
                        }
                        
                        if (historyMarks.length > 0) {
                          // Build history for each learner
                          finalResults.forEach(result => {
                            const lid = result.learner.id
                            termHistory[lid] = []
                            
                            try {
                              // Collect all unique exams for this learner
                              const exams = new Map<string, {term: string, examType: string, total: number, count: number}>()
                              
                              historyMarks
                                .filter(m => m && m.learner_id === lid)
                                .forEach(m => {
                                  if (!m || !m.term || !m.exam_type_id) return
                                  const key = `${m.term}|${m.exam_type_id}`
                                  if (!exams.has(key)) {
                                    exams.set(key, {
                                      term: m.term,
                                      examType: m.exam_types?.name || 'Unknown',
                                      total: 0,
                                      count: 0
                                    })
                                  }
                                  const exam = exams.get(key)!
                                  if (m.score !== null) {
                                    exam.total += Number(m.score) || 0
                                    exam.count += 1
                                  }
                                })
                              
                              // Sort by term order (1, 2, 3) then by exam type
                              const examOrder: Record<string, number> = { 'Opener': 0, 'Mid-Term': 1, 'End-Term': 2 }
                              const sorted = Array.from(exams.values())
                                .sort((a, b) => {
                                  const termA = parseInt(a.term) || 0
                                  const termB = parseInt(b.term) || 0
                                  if (termA !== termB) return termA - termB
                                  return (examOrder[a.examType] || 999) - (examOrder[b.examType] || 999)
                                })
                              
                              termHistory[lid] = sorted.map(e => ({
                                term: e.term,
                                exam_type: e.examType,
                                total: e.total,
                                count: e.count,
                                average: e.count > 0 ? e.total / e.count : 0
                              }))
                            } catch (historyErr) {
                              console.error('[v0] Error building history for learner', lid, ':', historyErr)
                              termHistory[lid] = []
                            }
                          })
                          
                          console.log('[v0] History built for', Object.keys(termHistory).length, 'learners')
                        }
                      } catch (historyFetchErr) {
                        console.error('[v0] ✗ History marks fetch error:', historyFetchErr)
                      }
                    }
                  } catch (err) {
                    console.error('[v0] ✗ History outer error:', err)
                  }
                  
                  console.log('[v0] === SETTING REPORT DATA AND OPENING MODAL ===')
                  setReportModalData(finalResults)
                  setTermHistory(termHistory)
                  setReportModalOpen(true)
                }}
                disabled={results.length === 0 || !selectedSessionId || !currentClass?.id} 
                className="bg-green-600 text-white hover:bg-green-700 h-9 text-xs sm:text-sm"
                id="bulk-print-btn"
              >
                <FileText className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Print All Reports</span>
              </Button>
            )}
            {currentSchool?.feature_whatsapp_reports && (
              <Button 
                onClick={() => {
                  const studentsWithPhone = results.filter(r => r.learner.parent_phone)
                  if (studentsWithPhone.length === 0) {
                    alert('No students have registered parent phone numbers. Please add parent phone numbers in the Learners tab.')
                    return
                  }
                  setWhatsappQueue(studentsWithPhone)
                  setWhatsappCurrentIndex(0)
                  setWhatsappSentCount(0)
                  setWhatsappModalOpen(true)
                }} 
                disabled={results.length === 0 || !selectedSessionId || !currentClass?.id} 
                className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 text-xs sm:text-sm"
              >
                <svg className="w-4 h-4 sm:mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="hidden sm:inline">Send All via WhatsApp</span>
              </Button>
            )}
          </div>
        </div>

        <Card className="py-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Exam Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Filter by Year</Label>
                <Select value={selectedYear || ""} onValueChange={(value) => {
                  setSelectedYear(value);
                  setSelectedTerm("");
                  setSelectedSessionId("");
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(sessions.map(s => s.year)))
                      .sort((a, b) => b - a)
                      .map((year) => (
                        <SelectItem key={year} value={year.toString()} className="text-sm">
                          {year}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sessions.filter(s => s.year.toString() === selectedYear).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Filter by Term</Label>
                <Select value={selectedTerm || "all"} onValueChange={(value) => {
                  setSelectedTerm(value === "all" ? "" : value);
                  setSelectedSessionId("");
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm">All terms</SelectItem>
                    {Array.from(new Set(sessions.filter(s => s.year.toString() === selectedYear).map(s => s.term)))
                      .map((term) => (
                        <SelectItem key={term} value={term} className="text-sm">
                          {term}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Exam Session</Label>
              <Select value={selectedSessionId || ""} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions
                    .filter(session => 
                      session.year.toString() === selectedYear &&
                      (!selectedTerm || session.term === selectedTerm)
                    )
                    .map((session) => (
                      <SelectItem key={session.id} value={session.id} className="text-sm">
                        {session.exam_types?.name} • {session.term} • {session.year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSessionId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Class Manager/Teacher Name</Label>
                <Input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Enter teacher name"
                  className="text-xs h-8"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print area */}
      {selectedSessionId && (
        <div id="print-area" className="bg-white p-2">
          {/* Print header - hidden */}
          <div className="print-header" style={{ display: 'none' }}></div>
          
          {/* Marklist Title */}
          <div className="marklist-title">{currentSchool?.name || 'School'.toUpperCase()}</div>
          
          {/* Marklist Subtitle */}
          <div className="marklist-subtitle">
            <div className="font-bold">{currentClass?.name}</div>
            <div>{selectedSession?.exam_types?.name} • {selectedSession?.term} • {selectedSession?.year}</div>
            <div className="text-xs mt-0.5">Date Printed: {new Date().toLocaleDateString()}</div>
          </div>

          {/* Marklist table */}
          <div className="overflow-x-auto">
            {(() => {
              const className = currentClass?.name || ''
              const classWords = className.trim().split(/\s+/)
              const isStreamedClass = classWords.length > 2
              
              return (
                <table className="w-full text-base border-collapse border-2 border-gray-800">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-600 p-2 text-left font-bold">No.</th>
                  <th className="border border-gray-600 p-2 text-left font-bold">Name</th>
                  {subjects.map((subject) => (
                    <React.Fragment key={subject.id}>
                      <th colSpan={3} className="border border-gray-600 p-2 font-bold text-center">
                        {subject.name}
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="border border-gray-600 p-2 font-bold">Total</th>
                  <th className="border border-gray-600 p-2 font-bold">Average</th>
                </tr>
                <tr className="bg-gray-200">
                  <th className="border border-gray-600 p-2 text-left font-bold"></th>
                  <th className="border border-gray-600 p-2 text-left font-bold"></th>
                  {subjects.map((subject) => (
                    <React.Fragment key={`header-${subject.id}`}>
                      <th className="border border-gray-600 p-2 font-bold text-xs">
                        Marks
                      </th>
                      <th className="border border-gray-600 p-2 font-bold text-xs" style={{ color: '#1a3a52' }}>
                        Level
                      </th>
                      <th className="border border-gray-600 p-2 font-bold text-xs" style={{ color: '#d97706' }}>
                        Points
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="border border-gray-600 p-2 font-bold"></th>
                  <th className="border border-gray-600 p-2 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => (
                  <tr key={result.learner.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-500 p-2 text-left">{idx + 1}</td>
                    <td className="border border-gray-500 p-2 text-left font-medium">
                      {result.learner.name}
                    </td>
                    {subjects.map((subject) => {
                      const score = result.marks[subject.id]
                      const performanceLevel = getGradeLevelByClass(score, currentClass?.name, currentSchool?.name)
                      return (
                        <React.Fragment key={subject.id}>
                          <td className="border border-gray-500 p-2 text-center">
                            {score ?? '-'}
                          </td>
                          <td className="border border-gray-500 p-2 text-center font-bold" style={{ color: '#1a3a52' }}>
                            {performanceLevel ? performanceLevel.level : '-'}
                          </td>
                          <td className="border border-gray-500 p-2 text-center font-bold" style={{ color: '#d97706' }}>
                            {performanceLevel ? performanceLevel.points : '-'}
                          </td>
                        </React.Fragment>
                      )
                    })}
                    <td className="border border-gray-500 p-2 text-center font-bold">{result.total}</td>
                    <td className="border border-gray-500 p-2 text-center font-bold" style={{ color: '#1a3a52' }}>
                      {(() => {
                        const avgPerformanceLevel = getGradeLevelByClass(Math.round(result.average), currentClass?.name, currentSchool?.name)
                        return avgPerformanceLevel ? avgPerformanceLevel.level : '-'
                      })()}
                    </td>
                  </tr>
                ))}
                {/* Subject Means Row */}
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-600 p-2" colSpan={2}>MEAN</td>
                  {subjects.map((subject) => {
                    const scores = results.map(r => r.marks[subject.id]).filter((m): m is number => m !== null && m !== undefined)
                    const mean = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0
                    const meanPerformance = getGradeLevelByClass(Math.round(mean), currentClass?.name, currentSchool?.name)
                    return (
                      <React.Fragment key={`mean-${subject.id}`}>
                        <td className="border border-gray-600 p-2 text-center text-sm">
                          {scores.length > 0 ? mean.toFixed(1) : '-'}
                        </td>
                        <td className="border border-gray-600 p-2 text-center text-sm font-bold" style={{ color: '#1a3a52' }}>
                          {meanPerformance ? meanPerformance.level : '-'}
                        </td>
                        <td className="border border-gray-600 p-2 text-center text-sm font-bold" style={{ color: '#d97706' }}>
                          {meanPerformance ? meanPerformance.points : '-'}
                        </td>
                      </React.Fragment>
                    )
                  })}
                  <td className="border border-gray-600 p-2 text-center font-bold">
                    {results.length > 0 ? results.reduce((a, b) => a + b.total, 0) : '-'}
                  </td>
                  <td className="border border-gray-600 p-2 text-center font-bold">
                    {classAverage}
                  </td>
                </tr>
              </tbody>
            </table>
              )
            })()}
          </div>

          {/* Footer info */}
          <div style={{ fontSize: '8pt', marginTop: '0.5rem', textAlign: 'center' }}>
            <div>Total Students: {results.length}</div>
            <div>Class Average: {classAverage}</div>
            {teacherName && <div>Class Manager: {teacherName}</div>}
          </div>
        </div>
      )}

      {/* Tabs for screen view */}
      {selectedSessionId && (
        <div className="print:hidden">
          <Tabs defaultValue="marklist" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full max-w-4xl">
              <TabsTrigger value="marklist" className="flex-1 min-w-[80px] text-xs sm:text-sm">Marklist</TabsTrigger>
              {(() => {
                const className = currentClass?.name || ''
                const classWords = className.trim().split(/\s+/)
                const isStreamedClass = classWords.length > 2
                return isStreamedClass ? (
                  <TabsTrigger value="stream-transfers" className="flex-1 min-w-[80px] text-xs sm:text-sm">Stream Transfers</TabsTrigger>
                ) : null
              })()}
              <TabsTrigger value="analysis" className="flex-1 min-w-[80px] text-xs sm:text-sm font-semibold bg-blue-50">Analysis</TabsTrigger>
            </TabsList>

            {/* Marklist Tab */}
            <TabsContent value="marklist">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                <table className="w-full text-base border-collapse border-2 border-gray-800">
                      <thead>
                        <tr className="bg-gray-200">
                          <th className="border border-gray-600 p-2 text-left font-bold">No.</th>
                          <th className="border border-gray-600 p-2 text-left font-bold">Name</th>
                          {subjects.map((subject) => (
                            <React.Fragment key={subject.id}>
                              <th colSpan={3} className="border border-gray-600 p-2 font-bold text-center">
                                {subject.name}
                              </th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-600 p-2 font-bold">Total</th>
                          <th className="border border-gray-600 p-2 font-bold">Average</th>
                          <th className="border border-gray-600 p-2 font-bold no-print">Report</th>
                        </tr>
                        <tr className="bg-gray-200">
                          <th className="border border-gray-600 p-2 text-left font-bold"></th>
                          <th className="border border-gray-600 p-2 text-left font-bold"></th>
                          {subjects.map((subject) => (
                            <React.Fragment key={subject.id}>
                  <th className="border border-gray-600 p-2 font-bold text-sm">
                                Marks
                              </th>
                              <th className="border border-gray-600 p-2 font-bold text-xs" style={{ color: '#1a3a52' }}>
                                Level
                              </th>
                              <th className="border border-gray-600 p-2 font-bold text-xs" style={{ color: '#d97706' }}>
                                Points
                              </th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-600 p-2 font-bold"></th>
                          <th className="border border-gray-600 p-2 font-bold"></th>
                          <th className="border border-gray-600 p-2 font-bold no-print"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((result, idx) => (
                          <tr key={result.learner.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-500 p-2 text-left">{idx + 1}</td>
                            <td className="border border-gray-500 p-2 text-left font-medium">{result.learner.name}</td>
                            {subjects.map((subject) => {
                              const score = result.marks[subject.id]
                              const performanceLevel = getGradeLevelByClass(score, currentClass?.name, currentSchool?.name)
                              return (
                                <React.Fragment key={subject.id}>
                                  <td className="border border-gray-500 p-2 text-center">
                                    {score ?? '-'}
                                  </td>
                                  <td className="border border-gray-500 p-2 text-center font-bold" style={{ color: '#1a3a52' }}>
                                    {performanceLevel ? performanceLevel.level : '-'}
                                  </td>
                                  <td className="border border-gray-500 p-2 text-center font-bold" style={{ color: '#d97706' }}>
                                    {performanceLevel ? performanceLevel.points : '-'}
                                  </td>
                                </React.Fragment>
                              )
                            })}
                            <td className="border border-gray-500 p-2 text-center font-bold">{result.total}</td>
                            <td className="border border-gray-500 p-2 text-center font-bold" style={{ color: '#1a3a52' }}>
                              {(() => {
                                const avgPerformanceLevel = getGradeLevelByClass(Math.round(result.average), currentClass?.name, currentSchool?.name)
                                return avgPerformanceLevel ? avgPerformanceLevel.level : '-'
                              })()}
                            </td>
                            <td className="border border-gray-500 p-2 text-center no-print">
                              <div className="flex gap-1 justify-center">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    // Pass the result with its correct rank that's already calculated in the results array
                                    setReportModalData([result])
                                    setReportModalOpen(true)
                                  }}
                                  className="h-7 px-2 text-xs"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Print
                                </Button>
                                {currentSchool?.feature_whatsapp_reports && result.learner.parent_phone && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      const phone = result.learner.parent_phone?.replace(/[^0-9]/g, '')
                                      const formattedPhone = phone?.startsWith('0') ? `254${phone.substring(1)}` : phone
                                      const gradeInfo = getGradeLevelByClass(Math.round(result.average), currentClass?.name, currentSchool?.name)
                                      const performanceLevel = gradeInfo?.level || '-'
                                      
                                      // Build subject details
                                      const subjectDetails = subjects.map(subject => {
                                        const score = result.marks[subject.id]
                                        if (score === null || score === undefined) return null
                                        const subjectGrade = getGradeLevelByClass(Math.round(score), currentClass?.name, currentSchool?.name)
                                        return `• ${subject.name}: *${score}%* (${subjectGrade?.level || '-'})`
                                      }).filter(Boolean).join('\n')
                                      
                                      const message = encodeURIComponent(
                                        `*${currentSchool?.name?.toUpperCase() || 'SCHOOL'}*\n` +
                                        `-------------------\n` +
                                        `*EXAM RESULTS NOTIFICATION*\n\n` +
                                        `Dear Parent/Guardian,\n\n` +
                                        `We are pleased to share the ${selectedSession?.exam_types?.name || 'Exam'} results for:\n\n` +
                                        `*Student:* ${result.learner.name}\n` +
                                        `*Class:* ${currentClass?.name || ''}\n` +
                                        `*Term:* ${selectedSession?.term}, ${selectedSession?.year}\n\n` +
                                        `*SUBJECT PERFORMANCE*\n` +
                                        `-------------------\n` +
                                        `${subjectDetails}\n\n` +
                                        `*OVERALL SUMMARY*\n` +
                                        `-------------------\n` +
                                        `• Total Marks: *${result.total}*\n` +
                                        `• Mean Score: *${result.average.toFixed(1)}%*\n` +
                                        `• Performance Level: *${performanceLevel}*\n` +
                                        `• Class Position: *${result.rank} of ${results.length}*\n\n` +
                                        `Thank you for your continued support in your child's education.\n\n` +
                                        `_${currentSchool?.name || 'School'}_\n` +
                                        `_Powered by Shuletech_`
                                      )
                                      window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
                                    }}
                                    className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                    title="Send results via WhatsApp"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {/* Subject Means Row */}
                        <tr className="bg-gray-200 font-bold">
                          <td className="border border-gray-600 p-2" colSpan={2}>MEAN</td>
                          {subjects.map((subject) => {
                            const scores = results.map(r => r.marks[subject.id]).filter((m): m is number => m !== null && m !== undefined)
                            const mean = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0
                            const meanPerformance = getGradeLevelByClass(Math.round(mean), currentClass?.name, currentSchool?.name)
                            return (
                              <React.Fragment key={`mean-${subject.id}`}>
                  <td className="border border-gray-600 p-2 text-center text-base">
                                  {scores.length > 0 ? mean.toFixed(1) : '-'}
                                </td>
                                <td className="border border-gray-600 p-2 text-center text-sm font-bold" style={{ color: '#1a3a52' }}>
                                  {meanPerformance ? meanPerformance.level : '-'}
                                </td>
                                <td className="border border-gray-600 p-2 text-center text-sm font-bold" style={{ color: '#d97706' }}>
                                  {meanPerformance ? meanPerformance.points : '-'}
                                </td>
                              </React.Fragment>
                            )
                          })}
                          <td className="border border-gray-600 p-2 text-center">
                            {results.length > 0 ? results.reduce((a, b) => a + b.total, 0) : '-'}
                          </td>
                          <td className="border border-gray-600 p-2 text-center">
                            {classAverage}
                          </td>
                          <td className="border border-gray-600 p-2 no-print"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stream Transfers Tab - Only for streamed classes */}
            {(() => {
              const className = currentClass?.name || ''
              const classWords = className.trim().split(/\s+/)
              const isStreamedClass = classWords.length > 2
              return isStreamedClass ? (
                <TabsContent value="stream-transfers">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitCompareArrows className="w-5 h-5" />
                        Stream Transfers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StreamTransfersContent 
                        currentClass={currentClass} 
                        allClasses={allClasses}
                        subjects={subjects}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              ) : null
            })()}

            {/* Analysis Tab - Contains nested analysis tabs */}
            <TabsContent value="analysis">
              <Tabs defaultValue="class-performance" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                  <TabsTrigger value="class-performance" className="text-xs sm:text-sm">Class Analysis</TabsTrigger>
                  <TabsTrigger value="subject-performance" className="text-xs sm:text-sm">Subject Analysis</TabsTrigger>
                  <TabsTrigger value="exam-comparison" className="text-xs sm:text-sm">Comparison</TabsTrigger>
                  <TabsTrigger value="stream-comparison" className="text-xs sm:text-sm">Stream Analysis</TabsTrigger>
                  <TabsTrigger value="school-performance" className="text-xs sm:text-sm">School Analysis</TabsTrigger>
                </TabsList>

                {/* Class Performance Tab */}
                <TabsContent value="class-performance">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Class Performance Analysis
                  </CardTitle>
                  <Button size="sm" onClick={() => handleDownloadReport('class')}>
                    <Download className="w-4 h-4 mr-1" />
                    Download Report
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Header Info */}
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="font-semibold">Class:</span> {currentClass?.name}</div>
                      <div><span className="font-semibold">Exam:</span> {selectedSession?.exam_types?.name} - {selectedSession?.term} {selectedSession?.year}</div>
                      <div><span className="font-semibold">Teacher In Charge:</span> {teacherName || 'N/A'}</div>
                      <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Summary Statistics */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Summary Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center">
                        <p className="text-xs text-gray-600">Total Students</p>
                        <p className="text-2xl font-bold text-blue-600">{results.length}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                        <p className="text-xs text-gray-600">Class Average</p>
                        <p className="text-2xl font-bold text-green-600">{classAverage}</p>
                      </div>
                      <div className="bg-teal-50 p-3 rounded-lg border border-teal-200 text-center">
                        <p className="text-xs text-gray-600">Class Median</p>
                        <p className="text-2xl font-bold text-teal-600">{classMedian}</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-center">
                        <p className="text-xs text-gray-600">Highest Total</p>
                        <p className="text-2xl font-bold text-purple-600">{results.length > 0 ? Math.max(...results.map((r) => r.total)) : 0}</p>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-center">
                        <p className="text-xs text-gray-600">Lowest Total</p>
                        <p className="text-2xl font-bold text-red-600">{results.length > 0 ? Math.min(...results.map((r) => r.total)) : 0}</p>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                        <p className="text-xs text-gray-600">Pass Rate</p>
                        <p className="text-2xl font-bold text-amber-600">{classPassRate}%</p>
                      </div>
                    </div>
                  </div>


                  {/* Gender Analysis */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Gender Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-600">Male Students</p>
                            <p className="text-2xl font-bold text-blue-600">{maleStudents.length}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Average</p>
                            <p className="text-2xl font-bold text-blue-600">{maleAverage}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-600">Female Students</p>
                            <p className="text-2xl font-bold text-pink-600">{femaleStudents.length}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Average</p>
                            <p className="text-2xl font-bold text-pink-600">{femaleAverage}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top and Bottom Performers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">Top 5 Performers</h3>
                      <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-green-100">
                            <tr>
                              <th className="p-2 text-left">Rank</th>
                              <th className="p-2 text-left">Name</th>
                              <th className="p-2 text-center">Total</th>
                              <th className="p-2 text-center">Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topPerformers.map((r, i) => {
                              const performanceLevel = getGradeLevelByClass(Math.round(r.average), currentClass?.name, currentSchool?.name)
                              return (
                                <tr key={r.learner.id} className="border-t border-green-200">
                                  <td className="p-2">{i + 1}</td>
                                  <td className="p-2">{r.learner.name}</td>
                                  <td className="p-2 text-center font-semibold">{r.total}</td>
                                  <td className="p-2 text-center font-semibold" style={{ color: '#1a3a52' }}>{performanceLevel ? performanceLevel.level : '-'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">Bottom 5 Performers</h3>
                      <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-red-100">
                            <tr>
                              <th className="p-2 text-left">Rank</th>
                              <th className="p-2 text-left">Name</th>
                              <th className="p-2 text-center">Total</th>
                              <th className="p-2 text-center">Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bottomPerformers.map((r, i) => {
                              const performanceLevel = getGradeLevelByClass(Math.round(r.average), currentClass?.name, currentSchool?.name)
                              return (
                                <tr key={r.learner.id} className="border-t border-red-200">
                                  <td className="p-2">{results.length - 4 + i}</td>
                                  <td className="p-2">{r.learner.name}</td>
                                  <td className="p-2 text-center font-semibold">{r.total}</td>
                                  <td className="p-2 text-center font-semibold" style={{ color: '#1a3a52' }}>{performanceLevel ? performanceLevel.level : '-'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subject Performance Tab */}
            <TabsContent value="subject-performance">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Subject Performance Analysis
                  </CardTitle>
                  <Button size="sm" onClick={() => handleDownloadReport('subject')}>
                    <Download className="w-4 h-4 mr-1" />
                    Download Report
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Header Info */}
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="font-semibold">Class:</span> {currentClass?.name}</div>
                      <div><span className="font-semibold">Exam:</span> {selectedSession?.exam_types?.name} - {selectedSession?.term} {selectedSession?.year}</div>
                      <div><span className="font-semibold">Teacher In Charge:</span> {teacherName || 'N/A'}</div>
                      <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Subject Performance Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-2 text-left">Rank</th>
                          <th className="border p-2 text-left">Subject</th>
                          <th className="border p-2 text-center">Mean</th>
                          <th className="border p-2 text-center">Highest</th>
                          <th className="border p-2 text-center">Lowest</th>
                          <th className="border p-2 text-center">Std Dev</th>
                          <th className="border p-2 text-center">Pass Rate</th>
                          <th className="border p-2 text-center">A</th>
                          <th className="border p-2 text-center">B</th>
                          <th className="border p-2 text-center">C</th>
                          <th className="border p-2 text-center">D</th>
                          <th className="border p-2 text-center">E</th>
                          <th className="border p-2 text-left">Top Performer</th>
                          <th className="border p-2 text-center">Certificate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectPerformance.map((subject, idx) => (
                          <tr key={subject.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border p-2 text-center font-semibold">{idx + 1}</td>
                            <td className="border p-2 font-medium">{subject.name}</td>
                            <td className="border p-2 text-center font-bold text-blue-600">{subject.mean}</td>
                            <td className="border p-2 text-center text-green-600">{subject.highest}</td>
                            <td className="border p-2 text-center text-red-600">{subject.lowest}</td>
                            <td className="border p-2 text-center">{subject.stdDev}</td>
                            <td className="border p-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(subject.passRate) >= 70 ? 'bg-green-100 text-green-700' : parseFloat(subject.passRate) >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {subject.passRate}%
                              </span>
                            </td>
                            <td className="border p-2 text-center bg-emerald-50">{subject.gradeA}</td>
                            <td className="border p-2 text-center bg-blue-50">{subject.gradeB}</td>
                            <td className="border p-2 text-center bg-yellow-50">{subject.gradeC}</td>
                            <td className="border p-2 text-center bg-orange-50">{subject.gradeD}</td>
                            <td className="border p-2 text-center bg-red-50">{subject.gradeE}</td>
                            <td className="border p-2 text-sm">{subject.topPerformer}</td>
                            <td className="border p-2 text-center">
                              {subject.topPerformer !== '-' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs bg-transparent"
                                  onClick={() => setCertificateData({
                                    studentName: subject.topPerformer,
                                    subjectName: subject.name,
                                    score: subject.topPerformerScore,
                                    className: currentClass?.name || '',
                                    examName: selectedSession?.exam_types?.name || '',
                                    term: selectedSession?.term || '',
                                    year: selectedSession?.year || 0,
                                  })}
                                >
                                  Print
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Subject Cards */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Subject Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subjectPerformance.map((subject, idx) => (
                        <div key={subject.name} className={`border rounded-lg p-4 ${idx === 0 ? 'bg-green-50 border-green-300' : idx === subjectPerformance.length - 1 ? 'bg-red-50 border-red-300' : 'bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-green-500 text-white' : idx === subjectPerformance.length - 1 ? 'bg-red-500 text-white' : 'bg-gray-400 text-white'}`}>
                                {idx + 1}
                              </span>
                              {subject.name}
                            </h4>
                            <span className="text-xl font-bold text-blue-600">{subject.mean}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="bg-white p-2 rounded text-center">
                              <p className="text-gray-500">Highest</p>
                              <p className="font-bold text-green-600">{subject.highest}</p>
                            </div>
                            <div className="bg-white p-2 rounded text-center">
                              <p className="text-gray-500">Lowest</p>
                              <p className="font-bold text-red-600">{subject.lowest}</p>
                            </div>
                            <div className="bg-white p-2 rounded text-center">
                              <p className="text-gray-500">Pass Rate</p>
                              <p className="font-bold">{subject.passRate}%</p>
                            </div>
                            <div className="bg-white p-2 rounded text-center">
                              <p className="text-gray-500">Std Dev</p>
                              <p className="font-bold">{subject.stdDev}</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t text-xs text-gray-600 flex items-center justify-between">
                            <span><span className="font-medium">Top Performer:</span> {subject.topPerformer} ({subject.topPerformerScore})</span>
                            {subject.topPerformer !== '-' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs bg-transparent px-2"
                                onClick={() => setCertificateData({
                                  studentName: subject.topPerformer,
                                  subjectName: subject.name,
                                  score: subject.topPerformerScore,
                                  className: currentClass?.name || '',
                                  examName: selectedSession?.exam_types?.name || '',
                                  term: selectedSession?.term || '',
                                  year: selectedSession?.year || 0,
                                })}
                              >
                                Print Certificate
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Exam Comparison Tab */}
            <TabsContent value="exam-comparison">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <GitCompareArrows className="w-5 h-5" />
                      Exam Comparison
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => fetchExamComparison(comparisonClassId || undefined)} disabled={isLoadingComparison}>
                        {isLoadingComparison ? 'Loading...' : 'Refresh'}
                      </Button>
                      {comparisonData && (
                        <Button size="sm" onClick={() => handleDownloadReport('comparison')}>
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Admin: class dropdown selector */}
                  {isAdminUser && allClasses.length > 0 && (
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium whitespace-nowrap">Select Class:</Label>
                      <Select value={comparisonClassId || currentClass?.id || ''} onValueChange={(val) => setComparisonClassId(val)}>
                        <SelectTrigger className="max-w-xs h-9">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {allClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Teacher/Admin: previous exam selector using buttons */}
                  {selectedSession && sessions.length > 1 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Compare With:</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant={comparisonSessionId === "" ? "default" : "outline"} 
                          size="sm"
                          onClick={() => setComparisonSessionId("")}
                        >
                          Auto-select Previous
                        </Button>
                        {sessions
                          .filter(s => s.id !== selectedSession.id)
                          .map((session) => (
                            <Button
                              key={session.id}
                              variant={comparisonSessionId === session.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => setComparisonSessionId(session.id)}
                            >
                              {session.exam_types?.name}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {!comparisonData && !isLoadingComparison && (
                    <div className="text-center py-10 text-gray-500">
                      <GitCompareArrows className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No previous exam found for comparison</p>
                      <p className="text-xs mt-1">A comparison requires at least two exams (e.g. Opener then Mid Term)</p>
                    </div>
                  )}

                  {isLoadingComparison && (
                    <div className="text-center py-10 text-gray-500">Loading comparison data...</div>
                  )}

                  {comparisonData && (
                    <div className="space-y-6">
                      {/* Comparison Header */}
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-200">
                        <div className="flex items-center justify-between">
                          <div className="text-center flex-1">
                            <p className="text-xs text-gray-500 mb-1">Previous Exam</p>
                            <p className="font-bold text-lg text-gray-800">
                              {comparisonData.previousSession?.name}
                            </p>
                            <p className="text-xs text-gray-500">{comparisonData.previousSession?.term} {comparisonData.previousSession?.year}</p>
                            <p className="text-2xl font-bold text-gray-600 mt-2">{comparisonData.previousClassAvg}</p>
                            <p className="text-xs text-gray-400">Class Mean Total</p>
                          </div>
                          <div className="flex flex-col items-center px-6">
                            <span className="text-3xl font-bold text-indigo-500">vs</span>
                            {(() => {
                              const diff = comparisonData.currentClassAvg - comparisonData.previousClassAvg
                              return (
                                <div className={`mt-2 px-3 py-1 rounded-full text-sm font-bold ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : diff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                </div>
                              )
                            })()}
                          </div>
                          <div className="text-center flex-1">
                            <p className="text-xs text-gray-500 mb-1">Current Exam</p>
                            <p className="font-bold text-lg text-gray-800">
                              {comparisonData.currentSession?.name}
                            </p>
                            <p className="text-xs text-gray-500">{comparisonData.currentSession?.term} {comparisonData.currentSession?.year}</p>
                            <p className="text-2xl font-bold text-indigo-600 mt-2">{comparisonData.currentClassAvg}</p>
                            <p className="text-xs text-gray-400">Class Mean Total</p>
                          </div>
                        </div>
                      </div>

                      {/* Subject-by-Subject Comparison */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Subject Performance Comparison</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border p-2.5 text-left font-semibold">Subject</th>
                                <th className="border p-2.5 text-center font-semibold">{comparisonData.previousSession?.name} Mean</th>
                                <th className="border p-2.5 text-center font-semibold">{comparisonData.currentSession?.name} Mean</th>
                                <th className="border p-2.5 text-center font-semibold">Change</th>
                                <th className="border p-2.5 text-left font-semibold">Trend</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comparisonData.subjectComparisons.map((subj, idx) => (
                                <tr key={subj.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="border p-2.5 font-medium">{subj.name}</td>
                                  <td className="border p-2.5 text-center">{subj.previousMean}</td>
                                  <td className="border p-2.5 text-center font-semibold">{subj.currentMean}</td>
                                  <td className="border p-2.5 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${subj.change > 0 ? 'bg-emerald-100 text-emerald-700' : subj.change < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {subj.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : subj.change < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                      {subj.change > 0 ? '+' : ''}{subj.change}
                                    </span>
                                  </td>
                                  <td className="border p-2.5">
                                    <div className="flex items-center gap-1">
                                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${subj.change > 0 ? 'bg-emerald-500' : subj.change < 0 ? 'bg-red-500' : 'bg-gray-400'}`}
                                          style={{ width: `${Math.min(Math.abs(subj.change), 30) / 30 * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        {subj.change > 0 ? 'Improved' : subj.change < 0 ? 'Declined' : 'No change'}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Top Improvers & Top Droppers */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Top 3 Improvers */}
                        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
                          <h4 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                            <ArrowUpRight className="w-5 h-5" />
                            Top 3 Most Improved
                          </h4>
                          {comparisonData.topImprovers.length === 0 ? (
                            <p className="text-sm text-gray-500">No previous data to compare</p>
                          ) : (
                            <div className="space-y-3">
                              {comparisonData.topImprovers.map((l, i) => (
                                <div key={l.name} className="flex items-center justify-between bg-white rounded-lg p-3 border border-emerald-100">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">{i + 1}</span>
                                    <div>
                                      <p className="font-semibold text-sm">{l.name}</p>
                                      <p className="text-xs text-gray-500">{l.previousTotal} {'-->'} {l.currentTotal}</p>
                                    </div>
                                  </div>
                                  <span className="text-emerald-700 font-bold text-lg">+{l.change}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Top 3 Droppers */}
                        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                          <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                            <ArrowDownRight className="w-5 h-5" />
                            Top 3 Most Dropped
                          </h4>
                          {comparisonData.topDroppers.length === 0 ? (
                            <p className="text-sm text-gray-500">No previous data to compare</p>
                          ) : (
                            <div className="space-y-3">
                              {comparisonData.topDroppers.map((l, i) => (
                                <div key={l.name} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">{i + 1}</span>
                                    <div>
                                      <p className="font-semibold text-sm">{l.name}</p>
                                      <p className="text-xs text-gray-500">{l.previousTotal} {'-->'} {l.currentTotal}</p>
                                    </div>
                                  </div>
                                  <span className="text-red-700 font-bold text-lg">{l.change}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Full Learner Comparison Table */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-800">Full Learner Comparison</h3>
                          <Button size="sm" onClick={() => downloadFullLearnerComparison()}>
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border p-2 text-left font-semibold">Name</th>
                                <th className="border p-2 text-center font-semibold">Prev Total</th>
                                <th className="border p-2 text-center font-semibold">Prev Rank</th>
                                <th className="border p-2 text-center font-semibold">Curr Total</th>
                                <th className="border p-2 text-center font-semibold">Curr Rank</th>
                                <th className="border p-2 text-center font-semibold">Marks Change</th>
                                <th className="border p-2 text-center font-semibold">Rank Change</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comparisonData.learnerComparisons.map((l, idx) => {
                                const rankChange = l.previousRank - l.currentRank
                                return (
                                  <tr key={l.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border p-2 font-medium">{l.name}</td>
                                    <td className="border p-2 text-center">{l.previousTotal || '-'}</td>
                                    <td className="border p-2 text-center">{l.previousTotal > 0 ? l.previousRank : '-'}</td>
                                    <td className="border p-2 text-center font-semibold">{l.currentTotal || '-'}</td>
                                    <td className="border p-2 text-center font-semibold">{l.currentTotal > 0 ? l.currentRank : '-'}</td>
                                    <td className="border p-2 text-center">
                                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${l.change > 0 ? 'bg-emerald-100 text-emerald-700' : l.change < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {l.change > 0 ? '+' : ''}{l.change}
                                      </span>
                                    </td>
                                    <td className="border p-2 text-center">
                                      {l.previousTotal > 0 && l.currentTotal > 0 ? (
                                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${rankChange > 0 ? 'bg-emerald-100 text-emerald-700' : rankChange < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                          {rankChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : rankChange < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                          {rankChange > 0 ? '+' : ''}{rankChange}
                                        </span>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stream Comparison Tab */}
            <TabsContent value="stream-comparison">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <GitCompareArrows className="w-5 h-5" />
                    Stream Comparison Analysis
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedBaseClass} onValueChange={(val) => {
                      setSelectedBaseClass(val)
                      fetchStreamComparison(val)
                    }}>
                      <SelectTrigger className="w-40 sm:w-48">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {getBaseClassNames().map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => selectedBaseClass && fetchStreamComparison(selectedBaseClass)} disabled={isLoadingStreams || !selectedBaseClass}>
                      {isLoadingStreams ? 'Loading...' : 'Compare'}
                    </Button>
                    {streamComparisonData && (
                      <>
                      <Button size="sm" variant="default" onClick={() => selectedBaseClass && fetchCombinedMarklist(selectedBaseClass)} disabled={isLoadingCombined || !selectedBaseClass} className="bg-green-600 hover:bg-green-700 text-white">
                        {isLoadingCombined ? 'Loading...' : 'Combined Marklist'}
                      </Button>
                      {combinedMarklistData && (
                        <Button size="sm" variant="outline" onClick={() => {
                          try {
                            // Build table rows with color coding
                            const tableRows = combinedMarklistData.learners.map((learner, idx) => {
                              const isTop3 = learner.rank <= 3
                              const rowBg = learner.rank === 1 ? '#fef3c7' : learner.rank === 2 ? '#f3f4f6' : learner.rank === 3 ? '#fef1f5' : '#fff'
                              
                              const subjectCells = combinedMarklistData.subjects.map(subj => {
                                const score = learner.marks[subj.name]
                                const level = score !== null ? getGradeLevelByClass(score, selectedBaseClass, currentSchool?.name)?.level : '-'
                                const points = score !== null ? getGradeLevelByClass(score, selectedBaseClass, currentSchool?.name)?.points : '-'
                                let scoreStyle = ''
                                if (score !== null) {
                                  if (score >= 80) scoreStyle = 'color: #15803d; font-weight: bold;'
                                  else if (score >= 50) scoreStyle = 'color: #2563eb;'
                                  else if (score >= 30) scoreStyle = 'color: #b45309;'
                                  else scoreStyle = 'color: #dc2626;'
                                }
                                return `
                                  <td style="border: 1px solid #333; padding: 4px; text-align: center; ${scoreStyle}">${score !== null ? score : '-'}</td>
                                  <td style="border: 1px solid #333; padding: 4px; text-align: center; color: #1a3a52; font-weight: bold; font-size: 11px;">${level}</td>
                                  <td style="border: 1px solid #333; padding: 4px; text-align: center; color: #d97706; font-weight: bold; font-size: 11px;">${points}</td>
                                `
                              }).join('')
                              
                              const overallLevel = getGradeLevelByClass(Math.round(learner.average), selectedBaseClass, currentSchool?.name)?.level || '-'
                              
                              return `
                                <tr style="background: ${rowBg};">
                                  <td style="border: 1px solid #333; padding: 6px; text-align: center; ${isTop3 ? 'font-weight: bold;' : ''}">${learner.rank}</td>
                                  <td style="border: 1px solid #333; padding: 6px; ${isTop3 ? 'font-weight: 600;' : ''}">${learner.name}</td>
                                  <td style="border: 1px solid #333; padding: 6px; text-align: center; font-size: 12px;">${learner.stream}</td>
                                  ${subjectCells}
                                  <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${learner.total}</td>
                                  <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: 600; color: #1a3a52;">${overallLevel}</td>
                                </tr>
                              `
                            }).join('')

                            // Build subject headers with 3 columns per subject
                            const subjectHeaders = combinedMarklistData.subjects.map(subj => 
                              `<th colSpan="3" style="border: 1px solid #333; padding: 6px; text-align: center; background: #e5e7eb; font-size: 11px;">${subj.name}</th>`
                            ).join('')
                            
                            const subjectSubHeaders = combinedMarklistData.subjects.map(() => 
                              `<th style="border: 1px solid #333; padding: 4px; text-align: center; background: #f3f4f6; font-size: 10px;">MKS</th>
                               <th style="border: 1px solid #333; padding: 4px; text-align: center; background: #f3f4f6; font-size: 10px;">LVL</th>
                               <th style="border: 1px solid #333; padding: 4px; text-align: center; background: #f3f4f6; font-size: 10px;">PTS</th>`
                            ).join('')

                            const reportContent = `<!DOCTYPE html>
<html>
<head>
  <title>${selectedBaseClass} Combined Marklist</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
    body { padding: 20px; background: white; font-size: 11px; }
    table { border-collapse: collapse; width: 100%; margin-top: 15px; }
    th { background: #e5e7eb; font-weight: bold; padding: 6px; border: 1px solid #333; text-align: center; }
    td { padding: 6px; border: 1px solid #333; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
    .header h1 { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
    .header h2 { font-size: 13px; font-weight: 600; margin-bottom: 5px; }
    .header p { font-size: 11px; color: #666; }
    .footer { text-align: center; font-size: 9px; color: #999; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
    @media print { body { padding: 10px; } @page { size: A4 landscape; margin: 10mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${currentSchool?.name || 'School'}</h1>
    <h2>${selectedBaseClass} - COMBINED MARKLIST</h2>
    <p>${selectedSession?.exam_types?.name || 'Examination'} - Term ${selectedSession?.term || ''}, ${selectedSession?.year || ''}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th rowSpan="2" style="width: 35px;">Rank</th>
        <th rowSpan="2">Student Name</th>
        <th rowSpan="2" style="width: 50px;">Stream</th>
        ${subjectHeaders}
        <th rowSpan="2" style="width: 45px;">Total</th>
        <th rowSpan="2" style="width: 60px;">Level</th>
      </tr>
      <tr>
        ${subjectSubHeaders}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    <p>${currentSchool?.name} - Examination Management System</p>
  </div>
</body>
</html>`

                            // Create a new window for print preview
                            const printWindow = window.open('', '_blank')
                            if (!printWindow) {
                              alert('Please allow popups to print the combined marklist')
                              return
                            }
                            printWindow.document.write(reportContent)
                            printWindow.document.close()
                            printWindow.print()
                          } catch (error) {
                            console.error('Error generating combined marklist:', error)
                            alert('Failed to generate combined marklist. Please try again.')
                          }
                        }}>
                          <Printer className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">Print Combined</span>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        
                        try {
                          // Get all unique subjects
                          const allSubjects = new Set<string>()
                          streamComparisonData.streams.forEach(s => s.subjects.forEach(subj => allSubjects.add(subj.name)))
                          const subjectsList = Array.from(allSubjects).sort()

                          // Build stream overview rows
                          const streamOverviewRows = streamComparisonData.streams
                            .sort((a, b) => b.classAvg - a.classAvg)
                            .map((stream, idx) => `
                              <tr style="background: ${idx === 0 ? '#dcfce7' : idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                                <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
                                <td style="border: 1px solid #333; padding: 6px; font-weight: ${idx === 0 ? 'bold' : 'normal'};">${stream.className || '-'}</td>
                                <td style="border: 1px solid #333; padding: 6px; text-align: center;">${stream.learnerCount || '-'}</td>
                                <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${stream.classAvg ? stream.classAvg.toFixed(1) : '-'}</td>
                                <td style="border: 1px solid #333; padding: 6px; text-align: center;">${typeof stream.passRate === 'number' ? stream.passRate.toFixed(0) + '%' : (stream.passRate ? stream.passRate + '%' : '-')}</td>
                                <td style="border: 1px solid #333; padding: 6px;">${stream.topPerformer || '-'}</td>
                              </tr>
                            `).join('')

                          // Build subject comparison table headers
                          const streamHeaders = streamComparisonData.streams.map(s => 
                            `<th style="border: 1px solid #333; padding: 6px; text-align: center;">${s.name}</th>`
                          ).join('')

                          // Build subject comparison rows
                          const subjectComparisonRows = subjectsList.map(subjName => {
                            const streamCells = streamComparisonData.streams.map(stream => {
                              const subj = stream.subjects.find(s => s.name === subjName)
                              if (!subj) return `<td style="border: 1px solid #333; padding: 4px; text-align: center;">-</td>`
                              const allMeans = streamComparisonData.streams.map(s => s.subjects.find(ss => ss.name === subjName)?.mean || 0)
                              const maxMean = Math.max(...allMeans)
                              const isHighest = subj.mean === maxMean && subj.mean > 0
                              return `<td style="border: 1px solid #333; padding: 4px; text-align: center; ${isHighest ? 'background: #dcfce7; font-weight: bold;' : ''}">${subj.mean !== undefined ? subj.mean.toFixed(1) : '-'}</td>`
                            }).join('')
                            return `<tr><td style="border: 1px solid #333; padding: 6px; font-weight: 500;">${subjName}</td>${streamCells}</tr>`
                          }).join('')

                          const reportContent = `<!DOCTYPE html>
<html>
<head>
  <title>${selectedBaseClass} Stream Comparison Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
    body { padding: 15px; background: white; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    @media print { body { padding: 10px; } @page { size: A4 landscape; margin: 10mm; } }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px;">
    <h1 style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">${currentSchool?.name || 'School'}</h1>
    <h2 style="font-size: 14px; font-weight: 600;">${selectedBaseClass} STREAM COMPARISON REPORT</h2>
    <p style="font-size: 11px; color: #666;">${selectedSession?.exam_types?.name || 'Exam'} - Term ${selectedSession?.term || ''}, ${selectedSession?.year || ''}</p>
  </div>
  <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 8px; background: #f3f4f6; padding: 6px;">STREAM PERFORMANCE OVERVIEW</h3>
  <table style="font-size: 11px;">
      <tr style="background: #e5e7eb;">
        <th style="border: 1px solid #333; padding: 6px; text-align: left;">Rank</th>
        <th style="border: 1px solid #333; padding: 6px; text-align: left;">Stream</th>
        <th style="border: 1px solid #333; padding: 6px; text-align: center;">Students</th>
        <th style="border: 1px solid #333; padding: 6px; text-align: center;">Avg Score</th>
        <th style="border: 1px solid #333; padding: 6px; text-align: center;">Pass Rate</th>
        <th style="border: 1px solid #333; padding: 6px; text-align: left;">Top Performer</th>
      </tr>
      ${streamOverviewRows}
    </table>
  <h3 style="font-size: 12px; font-weight: bold; margin: 15px 0 8px 0; background: #f3f4f6; padding: 6px;">SUBJECT PERFORMANCE COMPARISON</h3>
  <table style="font-size: 11px;">
      <tr style="background: #e5e7eb;">
        <th style="border: 1px solid #333; padding: 6px; text-align: left;">Subject</th>
        ${streamHeaders}
      </tr>
      <tbody>${subjectComparisonRows}</tbody>
  </table>
  <p style="font-size: 9px; color: #666; margin-top: 20px; text-align: center;">Generated on ${new Date().toLocaleDateString()} | Shuletech Exam System</p>
</body>
</html>`

                          // Create blob and download
                          const blob = new Blob([reportContent], { type: 'text/html' })
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = `${selectedBaseClass}_Stream_Comparison_${new Date().toISOString().split('T')[0]}.html`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)
                        } catch (error) {
                          console.error('Error generating report:', error)
                          alert('Failed to generate report. Please try again.')
                        }
                      }}>
                        <Download className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Download Report</span>
                      </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Info */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200 print:hidden">
                    <h3 className="font-bold text-lg text-indigo-900">Cross-Stream Analysis</h3>
                    <p className="text-sm text-indigo-700">
                      Compare performance across different streams within the same grade level. Select a grade to see how each stream is performing.
                    </p>
                  </div>

                  {!streamComparisonData && !isLoadingStreams && (
                    <div className="text-center py-8 text-gray-500">
                      Select a grade level above to compare streams
                    </div>
                  )}

                  {isLoadingStreams && (
                    <div className="text-center py-8 text-gray-500">Loading stream data...</div>
                  )}

                  {streamComparisonData && streamComparisonData.streams.length > 0 && (
                    <>
                      {/* Stream Overview Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {streamComparisonData.streams.map((stream, idx) => (
                          <Card key={stream.classId} className={`border-2 ${idx === 0 ? 'border-yellow-400 bg-yellow-50' : idx === 1 ? 'border-gray-300 bg-gray-50' : idx === 2 ? 'border-amber-600 bg-amber-50' : 'border-gray-200'}`}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{stream.name}</CardTitle>
                                {idx < 3 && (
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-700'}`}>
                                    {idx + 1}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">Stream: {stream.streamName}</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-2xl font-bold text-blue-600">{stream.classAvg}</div>
                                  <div className="text-xs text-gray-500">Mean Score</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-2xl font-bold text-green-600">{stream.passRate}%</div>
                                  <div className="text-xs text-gray-500">Pass Rate</div>
                                </div>
                              </div>
                              <div className="text-xs">
                                <div className="flex justify-between py-1 border-b">
                                  <span>Total Learners:</span>
                                  <span className="font-semibold">{stream.totalLearners}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b">
                                  <span>Top Performer:</span>
                                  <span className="font-semibold text-emerald-600">{stream.topPerformer.name}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                  <span>Top Score:</span>
                                  <span className="font-semibold">{stream.topPerformer || 'N/A'}</span>
                                </div>
                              </div>
                              {/* Rubric distribution bar */}
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Rubric Distribution</p>
                                <div className="flex h-4 rounded-full overflow-hidden border">
                                  {(() => {
                                    const total = stream.rubricDistribution.r4 + stream.rubricDistribution.r3 + stream.rubricDistribution.r2 + stream.rubricDistribution.r1
                                    if (total === 0) return <div className="w-full bg-gray-200" />
                                    return (
                                      <>
                                        <div className="bg-emerald-500" style={{ width: `${(stream.rubricDistribution.r4 / total) * 100}%` }} />
                                        <div className="bg-blue-500" style={{ width: `${(stream.rubricDistribution.r3 / total) * 100}%` }} />
                                        <div className="bg-amber-400" style={{ width: `${(stream.rubricDistribution.r2 / total) * 100}%` }} />
                                        <div className="bg-red-500" style={{ width: `${(stream.rubricDistribution.r1 / total) * 100}%` }} />
                                      </>
                                    )
                                  })()}
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>R4: {stream.rubricDistribution.r4}</span>
                                  <span>R3: {stream.rubricDistribution.r3}</span>
                                  <span>R2: {stream.rubricDistribution.r2}</span>
                                  <span>R1: {stream.rubricDistribution.r1}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Subject-by-Subject Comparison Table */}
                      <div className="mt-6">
                        <h4 className="font-semibold text-lg mb-3">Subject Performance by Stream</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border p-2 text-left font-semibold">Subject</th>
                                {streamComparisonData.streams.map(stream => (
                                  <th key={stream.classId} className="border p-2 text-center font-semibold" colSpan={3}>
                                    {stream.streamName || stream.name}
                                  </th>
                                ))}
                              </tr>
                              <tr className="bg-gray-50">
                                <th className="border p-2"></th>
                                {streamComparisonData.streams.map(stream => (
                                  <React.Fragment key={`header-${stream.classId}`}>
                                    <th className="border p-1 text-center text-xs text-blue-600">Mean</th>
                                    <th className="border p-1 text-center text-xs text-green-600">High</th>
                                    <th className="border p-1 text-center text-xs text-red-600">Low</th>
                                  </React.Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                // Get all unique subjects across streams
                                const allSubjects = new Set<string>()
                                streamComparisonData.streams.forEach(s => s.subjects.forEach(subj => allSubjects.add(subj.name)))
                                
                                return Array.from(allSubjects).map(subjName => (
                                  <tr key={subjName} className="hover:bg-gray-50">
                                    <td className="border p-2 font-medium">{subjName}</td>
                                    {streamComparisonData.streams.map(stream => {
                                      const subj = stream.subjects.find(s => s.name === subjName)
                                      // Find the highest mean across streams for this subject to highlight winner
                                      const maxMean = Math.max(...streamComparisonData.streams
                                        .map(s => s.subjects.find(sub => sub.name === subjName)?.mean || 0))
                                      const isHighest = subj && subj.mean === maxMean && maxMean > 0
                                      
                                      return (
                                        <React.Fragment key={`${stream.classId}-${subjName}`}>
                                          <td className={`border p-1 text-center ${isHighest ? 'bg-green-100 font-bold text-green-700' : ''}`}>
                                            {subj?.mean || '-'}
                                          </td>
                                          <td className="border p-1 text-center text-green-600">{subj?.highest || '-'}</td>
                                          <td className="border p-1 text-center text-red-600">{subj?.lowest || '-'}</td>
                                        </React.Fragment>
                                      )
                                    })}
                                  </tr>
                                ))
                              })()}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-200 font-bold">
                                <td className="border p-2">Overall Mean</td>
                                {streamComparisonData.streams.map(stream => {
                                  const maxAvg = Math.max(...streamComparisonData.streams.map(s => s.classAvg))
                                  const isHighest = stream.classAvg === maxAvg && maxAvg > 0
                                  return (
                                    <td key={`avg-${stream.classId}`} colSpan={3} className={`border p-2 text-center ${isHighest ? 'bg-green-200 text-green-800' : ''}`}>
                                      {stream.classAvg}
                                    </td>
                                  )
                                })}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
                          <div className="text-3xl font-bold text-blue-700">{streamComparisonData.streams.length}</div>
                          <div className="text-sm text-blue-600">Streams Compared</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                          <div className="text-3xl font-bold text-green-700">
                            {streamComparisonData.streams.reduce((a, s) => a + s.totalLearners, 0)}
                          </div>
                          <div className="text-sm text-green-600">Total Learners</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
                          <div className="text-3xl font-bold text-purple-700">
                            {streamComparisonData.streams[0]?.name || '-'}
                          </div>
                          <div className="text-sm text-purple-600">Top Performing Stream</div>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-center">
                          <div className="text-3xl font-bold text-amber-700">
                            {streamComparisonData.streams.length > 0 
                              ? (streamComparisonData.streams.reduce((a, s) => a + s.classAvg, 0) / streamComparisonData.streams.length).toFixed(1)
                              : '0'}
                          </div>
                          <div className="text-sm text-amber-600">Grade Average</div>
                        </div>
                      </div>
                    </>
                  )}

                  {streamComparisonData && streamComparisonData.streams.length === 1 && (
                    <div className="text-center py-8 text-gray-500">
                      Only one stream found for {streamComparisonData.baseClassName}. Add more streams to compare.
                    </div>
                  )}

                  {/* Combined Marklist Display */}
                  {combinedMarklistData && (
                    <div className="border-t pt-6 mt-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Combined Marklist - {combinedMarklistData.baseClassName}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-gray-300 px-3 py-2 text-left">#</th>
                              <th className="border border-gray-300 px-3 py-2 text-left">Student Name</th>
                              <th className="border border-gray-300 px-3 py-2 text-left">Stream</th>
                              {combinedMarklistData.subjects.map(subject => (
                                <th key={subject.id} className="border border-gray-300 px-3 py-2 text-center text-xs">{subject.name}</th>
                              ))}
                              <th className="border border-gray-300 px-3 py-2 text-center">Total</th>
                              <th className="border border-gray-300 px-3 py-2 text-center">Level</th>
                              <th className="border border-gray-300 px-3 py-2 text-center">Rank</th>
                            </tr>
                          </thead>
                          <tbody>
                            {combinedMarklistData.learners.slice(0, 20).map((learner, idx) => (
                              <tr key={learner.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                                <td className="border border-gray-300 px-3 py-2 font-medium">{learner.name}</td>
                                <td className="border border-gray-300 px-3 py-2 text-xs">{learner.stream}</td>
                                {combinedMarklistData.subjects.map(subject => (
                                  <td key={subject.id} className="border border-gray-300 px-3 py-2 text-center text-xs">
                                    {learner.marks[subject.name] !== null && learner.marks[subject.name] !== undefined ? learner.marks[subject.name] : '-'}
                                  </td>
                                ))}
                                <td className="border border-gray-300 px-3 py-2 text-center font-semibold">{learner.total}</td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-semibold" style={{ color: '#1a3a52' }}>
                                  {getGradeLevelByClass(Math.round(learner.average), currentClass?.name, currentSchool?.name)?.level || '-'}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-semibold">{learner.rank}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {combinedMarklistData.learners.length > 20 && (
                        <p className="text-xs text-gray-500 mt-2">Showing 20 of {combinedMarklistData.learners.length} students. Print to see all.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* School Performance Tab */}
            <TabsContent value="school-performance">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <School className="w-5 h-5" />
                    School Performance Analysis (CBC)
                  </CardTitle>
                  <Button size="sm" onClick={fetchSchoolPerformance} disabled={isLoadingSchool}>
                    {isLoadingSchool ? 'Loading...' : 'Load School Data'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-bold text-lg text-blue-900">{currentSchool?.name || 'School'} - Whole School Analysis</h3>
                    <p className="text-sm text-blue-700">
                      {selectedSession?.exam_types?.name} - {selectedSession?.term} {selectedSession?.year} | CBC Competency-Based Assessment
                    </p>
                  </div>


                  {schoolPerformance.length === 0 && !isLoadingSchool && (
                    <div className="text-center py-8 text-gray-500">
                      Click "Load School Data" to fetch performance data across all classes
                    </div>
                  )}

                  {isLoadingSchool && (
                    <div className="text-center py-8 text-gray-500">Loading school-wide data...</div>
                  )}

                  {/* Category Cards */}
                  {schoolPerformance.map((cat) => {
                    const categoryColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
                      'Pre-School': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800', badge: 'bg-purple-600' },
                      'Lower Primary': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-600' },
                      'Upper Primary': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', badge: 'bg-blue-600' },
                      'Junior Secondary': { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', badge: 'bg-orange-600' },
                    }
                    const colors = categoryColors[cat.category] || categoryColors['Lower Primary']

                    // Sort classes by mean score descending for ranking
                    const rankedClasses = [...cat.classes].sort((a, b) => b.classAvg - a.classAvg)

                    return (
                      <div key={cat.category} className={`rounded-xl border-2 ${colors.border} overflow-hidden`}>
                        {/* Category Header */}
                        <div className={`${colors.bg} px-5 py-4 flex items-center justify-between`}>
                          <div>
                            <h3 className={`text-lg font-bold ${colors.text}`}>{cat.category}</h3>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {cat.totalLearners} learners across {cat.classes.length} classes
                            </p>
                          </div>
                          <div className={`${colors.badge} text-white px-4 py-2 rounded-lg text-center`}>
                            <div className="text-2xl font-bold">{cat.categoryAvg || '--'}</div>
                            <div className="text-xs opacity-90">Mean Score</div>
                          </div>
                        </div>

                        {/* Classes Table */}
                        <div className="p-4">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border p-2.5 text-center font-semibold w-12">Rank</th>
                                <th className="border p-2.5 text-left font-semibold">Class</th>
                                <th className="border p-2.5 text-center font-semibold">Learners</th>
                                <th className="border p-2.5 text-center font-semibold">Subjects</th>
                                <th className="border p-2.5 text-center font-semibold">Mean Score</th>
                                <th className="border p-2.5 text-center font-semibold">
                                  <span className="text-emerald-600">R4</span>
                                </th>
                                <th className="border p-2.5 text-center font-semibold">
                                  <span className="text-blue-600">R3</span>
                                </th>
                                <th className="border p-2.5 text-center font-semibold">
                                  <span className="text-amber-600">R2</span>
                                </th>
                                <th className="border p-2.5 text-center font-semibold">
                                  <span className="text-red-600">R1</span>
                                </th>
                                <th className="border p-2.5 text-left font-semibold">Best Subject</th>
                                <th className="border p-2.5 text-left font-semibold">Weakest Subject</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rankedClasses.map((cls, idx) => {
                                const totalRubrics = cls.rubricDistribution.r4 + cls.rubricDistribution.r3 + cls.rubricDistribution.r2 + cls.rubricDistribution.r1
                                const r4Pct = totalRubrics > 0 ? Math.round((cls.rubricDistribution.r4 / totalRubrics) * 100) : 0
                                const r3Pct = totalRubrics > 0 ? Math.round((cls.rubricDistribution.r3 / totalRubrics) * 100) : 0
                                const r2Pct = totalRubrics > 0 ? Math.round((cls.rubricDistribution.r2 / totalRubrics) * 100) : 0
                                const r1Pct = totalRubrics > 0 ? Math.round((cls.rubricDistribution.r1 / totalRubrics) * 100) : 0
                                const rank = cls.classAvg > 0 ? idx + 1 : '-'

                                return (
                                  <tr key={cls.classId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border p-2.5 text-center">
                                      {rank !== '-' ? (
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs ${rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-amber-700' : 'bg-gray-300'}`}>
                                          {rank}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="border p-2.5 font-medium">{cls.name}</td>
                                    <td className="border p-2.5 text-center">{cls.totalLearners}</td>
                                    <td className="border p-2.5 text-center">{cls.subjectCount}</td>
                                    <td className="border p-2.5 text-center">
                                      <span className={`font-bold text-base ${cls.classAvg >= 60 ? 'text-emerald-600' : cls.classAvg >= 40 ? 'text-blue-600' : cls.classAvg > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {cls.classAvg || '--'}
                                      </span>
                                    </td>
                                    <td className="border p-2.5 text-center">
                                      <div className="font-semibold text-emerald-700">{cls.rubricDistribution.r4}</div>
                                      <div className="text-xs text-gray-400">{r4Pct}%</div>
                                    </td>
                                    <td className="border p-2.5 text-center">
                                      <div className="font-semibold text-blue-700">{cls.rubricDistribution.r3}</div>
                                      <div className="text-xs text-gray-400">{r3Pct}%</div>
                                    </td>
                                    <td className="border p-2.5 text-center">
                                      <div className="font-semibold text-amber-700">{cls.rubricDistribution.r2}</div>
                                      <div className="text-xs text-gray-400">{r2Pct}%</div>
                                    </td>
                                    <td className="border p-2.5 text-center">
                                      <div className="font-semibold text-red-700">{cls.rubricDistribution.r1}</div>
                                      <div className="text-xs text-gray-400">{r1Pct}%</div>
                                    </td>
                                    <td className="border p-2.5 text-sm text-emerald-700">{cls.topSubject}</td>
                                    <td className="border p-2.5 text-sm text-red-600">{cls.weakestSubject}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>

                          {/* Category Rubric Distribution Bar */}
                          {(() => {
                            const totalR = cat.classes.reduce((a, c) => a + c.rubricDistribution.r4 + c.rubricDistribution.r3 + c.rubricDistribution.r2 + c.rubricDistribution.r1, 0)
                            const catR4 = cat.classes.reduce((a, c) => a + c.rubricDistribution.r4, 0)
                            const catR3 = cat.classes.reduce((a, c) => a + c.rubricDistribution.r3, 0)
                            const catR2 = cat.classes.reduce((a, c) => a + c.rubricDistribution.r2, 0)
                            const catR1 = cat.classes.reduce((a, c) => a + c.rubricDistribution.r1, 0)

                            if (totalR === 0) return null

                            return (
                              <div className="mt-4">
                                <p className="text-xs font-semibold text-gray-600 mb-1">Rubric Distribution - {cat.category}</p>
                                <div className="flex h-6 rounded-full overflow-hidden border">
                                  <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${(catR4 / totalR) * 100}%` }}>
                                    {Math.round((catR4 / totalR) * 100) > 5 && `${Math.round((catR4 / totalR) * 100)}%`}
                                  </div>
                                  <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${(catR3 / totalR) * 100}%` }}>
                                    {Math.round((catR3 / totalR) * 100) > 5 && `${Math.round((catR3 / totalR) * 100)}%`}
                                  </div>
                                  <div className="bg-amber-400 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${(catR2 / totalR) * 100}%` }}>
                                    {Math.round((catR2 / totalR) * 100) > 5 && `${Math.round((catR2 / totalR) * 100)}%`}
                                  </div>
                                  <div className="bg-red-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${(catR1 / totalR) * 100}%` }}>
                                    {Math.round((catR1 / totalR) * 100) > 5 && `${Math.round((catR1 / totalR) * 100)}%`}
                                  </div>
                                </div>
                                <div className="flex justify-between text-xs mt-1 text-gray-500">
                                  <span>Exceeding (R4): {catR4}</span>
                                  <span>Meeting (R3): {catR3}</span>
                                  <span>Approaching (R2): {catR2}</span>
                                  <span>Below (R1): {catR1}</span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}

                  {/* Overall School Summary */}
                  {schoolPerformance.length > 0 && (
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white">
                      <h3 className="text-lg font-bold mb-4">Overall School Summary</h3>
                      <div className="grid grid-cols-4 gap-4">
                        {schoolPerformance.map((cat) => (
                          <div key={cat.category} className="bg-white/10 rounded-lg p-4 text-center">
                            <p className="text-xs opacity-75">{cat.category}</p>
                            <p className="text-3xl font-bold mt-1">{cat.categoryAvg || '--'}</p>
                            <p className="text-xs opacity-60 mt-1">{cat.totalLearners} learners</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/20 text-center">
                        <p className="text-sm opacity-75">School-wide Mean</p>
                        <p className="text-4xl font-bold mt-1">
                          {(() => {
                            const validCats = schoolPerformance.filter(c => c.categoryAvg > 0)
                            return validCats.length > 0
                              ? (validCats.reduce((a, b) => a + b.categoryAvg, 0) / validCats.length).toFixed(1)
                              : '--'
                          })()}
                        </p>
                        <p className="text-xs opacity-60 mt-1">
                          Total Learners: {schoolPerformance.reduce((a, b) => a + b.totalLearners, 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!selectedSessionId && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center text-gray-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              <p>Select an exam session to view and print the marklist</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Card Modal - Starehe Style for all schools */}
      {currentSchool?.feature_report_cards && (
        <ReportStareheStyle
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            reports={reportModalData.map(report => {
              try {
                return {
                  ...report,
                  subjectPositions: subjects.reduce((acc, subject) => {
                    const studentScore = report.marks[subject.id]
                    if (studentScore === null || studentScore === undefined) {
                      acc[subject.id] = 0
                      return acc
                    }
                    // Calculate position for this subject using reportModalData (which has overall ranking for streamed classes)
                    const higherScores = reportModalData.filter(r => {
                      const score = r.marks[subject.id]
                      return score !== null && score !== undefined && score > studentScore
                    }).length
                    acc[subject.id] = higherScores + 1
                    return acc
                  }, {} as Record<string, number>)
                }
              } catch (err) {
                console.error('[v0] Error mapping report:', err, report)
                return report
              }
            })}
            subjects={subjects}
            sessionInfo={sessions.find(s => s.id === selectedSessionId) || null}
            className={currentClass?.name || ''}
            totalStudents={results.length}
            classTeacherName={currentClass?.teacher_name}
            termHistory={termHistory || {}}
          />
      )}

      {/* WhatsApp Bulk Send Modal */}
      {whatsappModalOpen && whatsappQueue.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-emerald-600 text-white">
              <h3 className="font-semibold text-lg">Send Results via WhatsApp</h3>
              <p className="text-sm opacity-90">Sending to {whatsappQueue.length} parents</p>
            </div>
            
            <div className="p-6">
              {whatsappCurrentIndex < whatsappQueue.length ? (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progress</span>
                      <span>{whatsappCurrentIndex + 1} of {whatsappQueue.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-emerald-600 h-2 rounded-full transition-all" 
                        style={{ width: `${((whatsappCurrentIndex) / whatsappQueue.length) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-1">Current Student:</p>
                    <p className="font-semibold text-lg">{whatsappQueue[whatsappCurrentIndex]?.learner.name}</p>
                    <p className="text-sm text-gray-600">Phone: {whatsappQueue[whatsappCurrentIndex]?.learner.parent_phone}</p>
                    <p className="text-sm text-gray-600">Average: {whatsappQueue[whatsappCurrentIndex]?.average.toFixed(1)}%</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        const result = whatsappQueue[whatsappCurrentIndex]
                        const phone = result.learner.parent_phone?.replace(/[^0-9]/g, '')
                        const formattedPhone = phone?.startsWith('0') ? `254${phone.substring(1)}` : phone
                        const gradeInfo = getGradeLevelByClass(Math.round(result.average), currentClass?.name, currentSchool?.name)
                        const performanceLevel = gradeInfo?.level || '-'
                        
                        const subjectDetails = subjects.map(subject => {
                          const score = result.marks[subject.id]
                          if (score === null || score === undefined) return null
                          const subjectGrade = getGradeLevelByClass(Math.round(score), currentClass?.name, currentSchool?.name)
                          return `• ${subject.name}: *${score}%* (${subjectGrade?.level || '-'})`
                        }).filter(Boolean).join('\n')
                        
                        const message = encodeURIComponent(
                          `*${currentSchool?.name?.toUpperCase() || 'SCHOOL'}*\n` +
                          `-------------------\n` +
                          `*EXAM RESULTS NOTIFICATION*\n\n` +
                          `Dear Parent/Guardian,\n\n` +
                          `We are pleased to share the ${selectedSession?.exam_types?.name || 'Exam'} results for:\n\n` +
                          `*Student:* ${result.learner.name}\n` +
                          `*Class:* ${currentClass?.name || ''}\n` +
                          `*Term:* ${selectedSession?.term}, ${selectedSession?.year}\n\n` +
                          `*SUBJECT PERFORMANCE*\n` +
                          `-------------------\n` +
                          `${subjectDetails}\n\n` +
                          `*OVERALL SUMMARY*\n` +
                          `-------------------\n` +
                          `• Total Marks: *${result.total}*\n` +
                          `• Mean Score: *${result.average.toFixed(1)}%*\n` +
                          `• Performance Level: *${performanceLevel}*\n` +
                          `• Class Position: *${result.rank} of ${results.length}*\n\n` +
                          `Thank you for your continued support in your child's education.\n\n` +
                          `_${currentSchool?.name || 'School'}_\n` +
                          `_Powered by Shuletech_`
                        )
                        window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
                        setWhatsappSentCount(prev => prev + 1)
                        setWhatsappCurrentIndex(prev => prev + 1)
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Send & Next
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setWhatsappCurrentIndex(prev => prev + 1)}
                    >
                      Skip
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Complete!</h4>
                  <p className="text-gray-600">Sent results to {whatsappSentCount} of {whatsappQueue.length} parents</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setWhatsappModalOpen(false)
                  setWhatsappQueue([])
                  setWhatsappCurrentIndex(0)
                  setWhatsappSentCount(0)
                }}
              >
                {whatsappCurrentIndex >= whatsappQueue.length ? 'Done' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Print Modal */}
      {certificateData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
            {/* Modal Controls */}
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-800">Certificate Preview</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const printContent = document.getElementById('certificate-content')
                    if (!printContent) return
                    const win = window.open('', '_blank')
                    if (!win) return
                    win.document.write(`<!DOCTYPE html><html><head><title>Certificate - ${certificateData.studentName}</title><style>@page{size:landscape;margin:0}body{margin:0;padding:0;}</style></head><body>${printContent.outerHTML}</body></html>`)
                    win.document.close()
                    win.focus()
                    setTimeout(() => { win.print(); win.close() }, 300)
                  }}
                >
                  <Printer className="w-4 h-4 mr-1" /> Print Certificate
                </Button>
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => setCertificateData(null)}>Close</Button>
              </div>
            </div>

            {/* Certificate Design */}
            <div className="p-6 flex justify-center overflow-auto">
              <div
                id="certificate-content"
                style={{
                  width: '800px',
                  minHeight: '560px',
                  background: 'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)',
                  position: 'relative',
                  fontFamily: 'Georgia, serif',
                  padding: '0',
                  overflow: 'hidden',
                }}
              >
                {/* Outer decorative border */}
                <div style={{
                  position: 'absolute',
                  inset: '12px',
                  border: '3px solid #b8860b',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                }} />
                {/* Inner decorative border */}
                <div style={{
                  position: 'absolute',
                  inset: '20px',
                  border: '1px solid #d4a853',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                }} />

                {/* Corner ornaments */}
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                  <div key={corner} style={{
                    position: 'absolute',
                    width: '60px',
                    height: '60px',
                    ...(corner.includes('top') ? { top: '24px' } : { bottom: '24px' }),
                    ...(corner.includes('left') ? { left: '24px' } : { right: '24px' }),
                    borderTop: corner.includes('top') ? '3px double #b8860b' : 'none',
                    borderBottom: corner.includes('bottom') ? '3px double #b8860b' : 'none',
                    borderLeft: corner.includes('left') ? '3px double #b8860b' : 'none',
                    borderRight: corner.includes('right') ? '3px double #b8860b' : 'none',
                    borderRadius: '4px',
                  }} />
                ))}

                {/* Certificate content */}
                <div style={{ position: 'relative', zIndex: 1, padding: '50px 60px', textAlign: 'center' }}>
                  {/* School name */}
                  <div style={{ fontSize: '14px', letterSpacing: '4px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {currentSchool?.name || 'School'}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontSize: '42px',
                    fontWeight: 'bold',
                    color: '#b8860b',
                    lineHeight: '1.1',
                    marginBottom: '6px',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                  }}>
                    Certificate of Excellence
                  </div>

                  {/* Decorative divider */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '12px 0' }}>
                    <div style={{ width: '100px', height: '1px', background: 'linear-gradient(to right, transparent, #b8860b)' }} />
                    <div style={{ width: '10px', height: '10px', border: '2px solid #b8860b', transform: 'rotate(45deg)' }} />
                    <div style={{ width: '100px', height: '1px', background: 'linear-gradient(to left, transparent, #b8860b)' }} />
                  </div>

                  {/* Presented to */}
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                    This certificate is proudly presented to
                  </div>

                  {/* Student name */}
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 'bold',
                    color: '#1f2937',
                    borderBottom: '2px solid #b8860b',
                    display: 'inline-block',
                    padding: '0 30px 6px',
                    marginBottom: '14px',
                    fontStyle: 'italic',
                  }}>
                    {certificateData.studentName}
                  </div>

                  {/* Achievement text */}
                  <div style={{ fontSize: '15px', color: '#374151', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 16px' }}>
                    For outstanding achievement as the <strong>Best Performer</strong> in
                  </div>

                  {/* Subject badge */}
                  <div style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #b8860b 0%, #d4a853 100%)',
                    color: 'white',
                    padding: '8px 32px',
                    borderRadius: '30px',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    marginBottom: '10px',
                    boxShadow: '0 2px 8px rgba(184,134,11,0.3)',
                  }}>
                    {certificateData.subjectName}
                  </div>

                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '6px' }}>
                    Scoring <strong style={{ color: '#b8860b', fontSize: '18px' }}>{certificateData.score}%</strong> in the {certificateData.examName}
                  </div>

                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '24px' }}>
                    {certificateData.className} | {certificateData.term} {certificateData.year}
                  </div>

                  {/* Signature section */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', padding: '0 20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '180px', borderBottom: '1px solid #9ca3af', marginBottom: '6px', height: '24px' }} />
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Class Teacher</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '60px', height: '60px', border: '2px solid #b8860b', borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#b8860b', fontWeight: 'bold' }}>
                        SEAL
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date().toLocaleDateString()}</div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Stream Transfers Component
function StreamTransfersContent({ currentClass, allClasses, subjects }: any) {
  const [streamLearners, setStreamLearners] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Get available streams for current grade
  const getAvailableStreams = () => {
    const className = currentClass?.name || ''
    const classWords = className.trim().split(/\s+/)
    const gradeLevel = classWords.slice(0, -1).join(' ')
    
    return allClasses.filter(c => 
      c.name.toLowerCase().startsWith(gradeLevel.toLowerCase()) && 
      c.name.trim().split(/\s+/).length > 2 &&
      c.id !== currentClass?.id
    )
  }

  // Load learners when component mounts or class changes
  useEffect(() => {
    const loadLearners = async () => {
      if (!currentClass?.id) return
      
      setIsLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('learners')
          .select('id, name, class_id')
          .eq('class_id', currentClass.id)
          .order('name')
        
        if (error) throw error
        setStreamLearners(data || [])
      } catch (error) {
        console.error('[v0] Error loading learners:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLearners()
  }, [currentClass?.id])

  const handleTransfer = async (learnerId: string, destinationStreamId: string) => {
    if (destinationStreamId === 'select') return

    setTransferringId(learnerId)
    try {
      const response = await fetch('/api/learners/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          newClassId: destinationStreamId,
          newStreamId: destinationStreamId,
          fromStream: currentClass?.name,
          toStream: allClasses.find(c => c.id === destinationStreamId)?.name
        })
      })

      if (response.ok) {
        const destinationName = allClasses.find(c => c.id === destinationStreamId)?.name
        const learnerName = streamLearners.find(l => l.id === learnerId)?.name
        setSuccessMessage(`${learnerName} transferred to ${destinationName}`)
        
        // Remove from list
        setStreamLearners(streamLearners.filter(l => l.id !== learnerId))
        
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        alert('Failed to transfer student')
      }
    } catch (error) {
      console.error('[v0] Transfer error:', error)
      alert('Error transferring student')
    } finally {
      setTransferringId(null)
    }
  }

  const availableStreams = getAvailableStreams()

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {availableStreams.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          No other streams available for this grade level
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Transfer learners to another stream in {currentClass?.name.split(' ').slice(0, -1).join(' ')}</p>
          
          {isLoading ? (
            <div className="text-center text-gray-500">Loading learners...</div>
          ) : streamLearners.length === 0 ? (
            <div className="text-center text-gray-500">No learners in this class</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {streamLearners.map((learner) => (
                <div key={learner.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded">
                  <span className="font-medium text-sm">{learner.name}</span>
                  <Select 
                    value="select"
                    onValueChange={(streamId) => handleTransfer(learner.id, streamId)}
                    disabled={transferringId === learner.id}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder="Move to..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select" disabled>Move to stream...</SelectItem>
                      {availableStreams.map(stream => (
                        <SelectItem key={stream.id} value={stream.id}>
                          {stream.name.split(' ').slice(2).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
