'use client'

import React, { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { sortClasses } from './utils'
import type { Deadline } from './types'
import { fetchAllRows } from '@/lib/fetch-all-rows'

type SubjectStatus = 'none' | 'partial' | 'complete' | 'unassigned'

interface SubjectRow {
  subjectId: string
  subjectName: string
  teacherName: string | null
  status: SubjectStatus
  markedCount: number
  totalLearners: number
}

interface ClassRow {
  classId: string
  className: string
  totalLearners: number
  subjects: SubjectRow[]
}

const STATUS_COLOR: Record<SubjectStatus, string> = {
  complete: 'bg-emerald-500',
  partial: 'bg-amber-400',
  none: 'bg-red-400',
  unassigned: 'bg-gray-300',
}

const STATUS_LABEL: Record<SubjectStatus, string> = {
  complete: 'Complete',
  partial: 'Partial',
  none: 'Not started',
  unassigned: 'No teacher assigned',
}

export function MarksEntryTracker({ schoolId, deadlines }: { schoolId: string; deadlines: Deadline[] }) {
  // Build (term, year, examType) options from the sessions already loaded for Overview
  const sessionOptions = useMemo(() => {
    const seen = new Map<string, { term: string; year: number; examType: string }>()
    for (const d of deadlines) {
      if (!d.term || !d.year || !d.exam_type) continue
      const key = `${d.term}|${d.year}|${d.exam_type}`
      if (!seen.has(key)) seen.set(key, { term: d.term, year: d.year, examType: d.exam_type })
    }
    return Array.from(seen.values()).sort((a, b) => b.year - a.year || a.term.localeCompare(b.term))
  }, [deadlines])

  const [selectedKey, setSelectedKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rows, setRows] = useState<ClassRow[] | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = async (key: string) => {
    setSelectedKey(key)
    const [term, yearStr, examType] = key.split('|')
    const year = Number(yearStr)
    if (!term || !year || !examType) return

    setIsLoading(true)
    const supabase = createClient()

    const { data: examTypeRow } = await supabase
      .from('exam_types')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', examType)
      .single()
    if (!examTypeRow) { setIsLoading(false); return }

    const [classesRes, sessionsRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('display_order'),
      supabase.from('sessions').select('id, class_id').eq('school_id', schoolId).eq('term', term).eq('year', year).eq('exam_type_id', examTypeRow.id),
    ])

    const classes = classesRes.data || []
    const sessions = sessionsRes.data || []
    const classIds = classes.map((c: any) => c.id)
    const sessionIds = sessions.map((s: any) => s.id)
    const sessionByClassId = new Map(sessions.map((s: any) => [s.class_id, s.id]))

    // Marks and learners can each easily exceed Supabase's 1000-row default
    // page cap across a whole school - must paginate or large schools silently
    // lose data past row 1000 and everything past it looks "not entered".
    const [subjectsRes, learners, assignmentsRes, teachersRes, marks] = await Promise.all([
      supabase.from('subjects').select('id, name, class_id').in('class_id', classIds),
      fetchAllRows<{ id: string; class_id: string }>((from, to) =>
        supabase.from('learners').select('id, class_id').in('class_id', classIds).range(from, to)
      ),
      supabase.from('teacher_assignments').select('user_id, class_id, subject_id').eq('school_id', schoolId).eq('is_active', true).not('subject_id', 'is', null),
      supabase.from('teacher_accounts').select('id, first_name, last_name').eq('school_id', schoolId),
      sessionIds.length > 0
        ? fetchAllRows<{ session_id: string; subject_id: string; learner_id: string; score: number | null }>((from, to) =>
            supabase.from('marks').select('session_id, subject_id, learner_id, score').in('session_id', sessionIds).range(from, to)
          )
        : Promise.resolve([]),
    ])

    const subjects = subjectsRes.data || []
    const assignments = assignmentsRes.data || []
    const teachers = teachersRes.data || []

    const teacherNameById = new Map<string, string>(
      teachers.map((t: any) => [t.id, [t.first_name, t.last_name].filter(Boolean).join(' ')])
    )
    const teacherByClassSubject = new Map<string, string | null>(
      assignments.map((a: any) => [`${a.class_id}|${a.subject_id}`, teacherNameById.get(a.user_id) || null])
    )

    const learnerCountByClass = new Map<string, number>()
    learners.forEach((l: any) => learnerCountByClass.set(l.class_id, (learnerCountByClass.get(l.class_id) || 0) + 1))

    const subjectsByClass = new Map<string, any[]>()
    subjects.forEach((s: any) => {
      if (!subjectsByClass.has(s.class_id)) subjectsByClass.set(s.class_id, [])
      subjectsByClass.get(s.class_id)!.push(s)
    })

    const marksBySubjectSession = new Map<string, Set<string>>()
    marks.forEach((m: any) => {
      if (m.score === null || m.score === undefined) return
      const key = `${m.session_id}|${m.subject_id}`
      if (!marksBySubjectSession.has(key)) marksBySubjectSession.set(key, new Set())
      marksBySubjectSession.get(key)!.add(m.learner_id)
    })

    const classRows: ClassRow[] = sortClasses(classes as any).map((c: any) => {
      const totalLearners = learnerCountByClass.get(c.id) || 0
      const sessionId = sessionByClassId.get(c.id)
      const classSubjects = subjectsByClass.get(c.id) || []

      const subjectRows: SubjectRow[] = classSubjects.map((s: any) => {
        const teacherName = teacherByClassSubject.get(`${c.id}|${s.id}`) || null
        const markedCount = sessionId ? (marksBySubjectSession.get(`${sessionId}|${s.id}`)?.size || 0) : 0

        let status: SubjectStatus
        if (!teacherName) status = 'unassigned'
        else if (markedCount === 0) status = 'none'
        else if (totalLearners > 0 && markedCount >= totalLearners) status = 'complete'
        else status = 'partial'

        return { subjectId: s.id, subjectName: s.name, teacherName, status, markedCount, totalLearners }
      })

      return { classId: c.id, className: c.name, totalLearners, subjects: subjectRows }
    })

    setRows(classRows)
    setIsLoading(false)
  }

  const toggleExpand = (classId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(classId)) next.delete(classId)
      else next.add(classId)
      return next
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Marks Entry Tracker
          </CardTitle>
          <CardDescription>Which classes and subjects have entered marks for an exam, and who's assigned</CardDescription>
        </div>
        <select
          value={selectedKey}
          onChange={(e) => load(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an exam...</option>
          {sessionOptions.map(opt => {
            const key = `${opt.term}|${opt.year}|${opt.examType}`
            return <option key={key} value={key}>{opt.examType} - {opt.term} {opt.year}</option>
          })}
        </select>
      </CardHeader>
      <CardContent>
        {!selectedKey && (
          <p className="text-sm text-gray-500 text-center py-8">Select an exam above to see marks-entry status by class and subject.</p>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {!isLoading && rows && (
          <div className="space-y-2">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 pb-2">
              {(['complete', 'partial', 'none', 'unassigned'] as SubjectStatus[]).map(s => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${STATUS_COLOR[s]}`}></span>
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>

            {rows.map(row => {
              const isExpanded = expanded.has(row.classId)
              const total = row.subjects.length
              const completeCount = row.subjects.filter(s => s.status === 'complete').length

              return (
                <div key={row.classId} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpand(row.classId)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span className="font-medium text-sm w-40 shrink-0">{row.className}</span>
                    <div className="flex-1 flex h-4 rounded-full overflow-hidden border border-gray-200 bg-gray-100">
                      {total === 0 ? (
                        <span className="text-[10px] text-gray-400 px-2 leading-4">No subjects configured</span>
                      ) : (
                        row.subjects.map(s => (
                          <div
                            key={s.subjectId}
                            title={`${s.subjectName}: ${STATUS_LABEL[s.status]}`}
                            className={STATUS_COLOR[s.status]}
                            style={{ width: `${100 / total}%` }}
                          />
                        ))
                      )}
                    </div>
                    <span className="text-xs text-gray-500 w-24 text-right shrink-0">{completeCount}/{total} complete</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="p-2">Subject</th>
                            <th className="p-2">Teacher</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Learners Marked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.subjects.map(s => (
                            <tr key={s.subjectId} className="border-t border-gray-200">
                              <td className="p-2 font-medium">{s.subjectName}</td>
                              <td className="p-2 text-gray-600">{s.teacherName || 'Not assigned'}</td>
                              <td className="p-2">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-[10px] ${STATUS_COLOR[s.status]}`}>
                                  {STATUS_LABEL[s.status]}
                                </span>
                              </td>
                              <td className="p-2 text-right">{s.markedCount}/{row.totalLearners}</td>
                            </tr>
                          ))}
                          {row.subjects.length === 0 && (
                            <tr><td colSpan={4} className="p-3 text-center text-gray-400">No subjects configured for this class</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
