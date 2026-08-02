'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Lock, Unlock, Calendar, Trash2, GraduationCap, Users, ClipboardList } from 'lucide-react'
import type { Deadline } from './_shared/types'
import { MarksEntryTracker } from './_shared/MarksEntryTracker'

export default function AdminOverviewPage() {
  const { currentSchool } = useSchool()

  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null)
  const [editingDeadlineValue, setEditingDeadlineValue] = useState('')

  const [deadlineFilters, setDeadlineFilters] = useState({
    className: '',
    examType: '',
    status: '', // '', 'open', 'deadline-set', 'locked'
  })

  const [stats, setStats] = useState({ totalClasses: 0, totalTeachers: 0 })

  const loadDeadlines = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()

    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('*, classes(name), exam_types(name)')
      .eq('school_id', currentSchool.id)
      .not('exam_type_id', 'is', null)
      .order('created_at', { ascending: false })

    if (sessionsData) {
      setDeadlines(sessionsData.map((s: any) => ({
        id: s.id,
        class_id: s.class_id,
        term: s.term,
        year: s.year,
        deadline_date: s.deadline_datetime || '',
        is_locked: s.is_locked,
        class_name: s.classes?.name,
        exam_type: s.exam_types?.name,
      })))
    }
    setIsLoading(false)
  }, [currentSchool?.id])

  useEffect(() => { loadDeadlines() }, [loadDeadlines])

  useEffect(() => {
    if (!currentSchool) return
    const supabase = createClient()
    Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', currentSchool.id),
      supabase.from('teacher_accounts').select('id', { count: 'exact', head: true }).eq('school_id', currentSchool.id),
    ]).then(([classesRes, teachersRes]) => {
      setStats({ totalClasses: classesRes.count || 0, totalTeachers: teachersRes.count || 0 })
    })
  }, [currentSchool?.id])

  const toggleSessionLock = async (sessionId: string, currentLocked: boolean) => {
    const supabase = createClient()
    await supabase.from('sessions').update({ is_locked: !currentLocked }).eq('id', sessionId)
    loadDeadlines()
  }

  const saveSessionDeadline = async (sessionId: string) => {
    if (!editingDeadlineValue) {
      setEditingDeadlineId(null)
      return
    }
    const supabase = createClient()
    await supabase
      .from('sessions')
      .update({ deadline_datetime: editingDeadlineValue ? new Date(editingDeadlineValue).toISOString() : null })
      .eq('id', sessionId)

    setEditingDeadlineId(null)
    setEditingDeadlineValue('')
    loadDeadlines()
  }

  const deleteSession = async (sessionId: string, sessionLabel: string) => {
    const confirmMessage = `Are you sure you want to delete the exam session "${sessionLabel}"?\n\nThis will permanently delete this session AND all marks entered for it.\n\nThis action cannot be undone.`
    if (!confirm(confirmMessage)) return

    try {
      setDeletingSessionId(sessionId)
      const supabase = createClient()

      await supabase.from('marks').delete().eq('session_id', sessionId)
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
      if (error) {
        alert(`Failed to delete session: ${error.message}`)
        setDeletingSessionId(null)
        return
      }

      if (currentSchool) {
        await supabase.from('activity_logs').insert({
          school_id: currentSchool.id,
          action: 'session_deleted',
          details: `Deleted exam session: ${sessionLabel}`,
          performed_by: 'Admin Portal',
        })
      }

      setDeadlines(deadlines.filter(d => d.id !== sessionId))
      setDeletingSessionId(null)
    } catch (err) {
      alert(`An error occurred: ${err instanceof Error ? err.message : String(err)}`)
      setDeletingSessionId(null)
    }
  }

  const filteredDeadlines = deadlines.filter(d => {
    if (deadlineFilters.className && d.class_name !== deadlineFilters.className) return false
    if (deadlineFilters.examType && d.exam_type !== deadlineFilters.examType) return false
    if (deadlineFilters.status === 'open' && (d.is_locked || d.deadline_date)) return false
    if (deadlineFilters.status === 'deadline-set' && (!d.deadline_date || d.is_locked)) return false
    if (deadlineFilters.status === 'locked' && !d.is_locked) return false
    return true
  })

  const uniqueClasses = Array.from(new Set(deadlines.map(d => d.class_name))).filter(Boolean).sort()
  const uniqueExamTypes = Array.from(new Set(deadlines.map(d => d.exam_type))).filter(Boolean).sort()
  const lockedCount = deadlines.filter(d => d.is_locked).length
  const openCount = deadlines.filter(d => !d.is_locked && !d.deadline_date).length

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{stats.totalClasses}</p>
              <p className="text-xs text-gray-500">Classes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold">{stats.totalTeachers}</p>
              <p className="text-xs text-gray-500">Teachers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-xs text-gray-500">Open Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Lock className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{lockedCount}</p>
              <p className="text-xs text-gray-500">Locked Sessions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Exam Sessions & Deadlines
          </CardTitle>
          <CardDescription>
            Set deadlines and lock/unlock exam sessions created by teachers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {/* Filter section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                <h3 className="font-medium text-gray-700">Filter Sessions</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-600">Class</label>
                    <select
                      value={deadlineFilters.className}
                      onChange={(e) => setDeadlineFilters({ ...deadlineFilters, className: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Classes</option>
                      {uniqueClasses.map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-600">Exam Type</label>
                    <select
                      value={deadlineFilters.examType}
                      onChange={(e) => setDeadlineFilters({ ...deadlineFilters, examType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Types</option>
                      {uniqueExamTypes.map(examType => (
                        <option key={examType} value={examType}>{examType}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <select
                      value={deadlineFilters.status}
                      onChange={(e) => setDeadlineFilters({ ...deadlineFilters, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="deadline-set">Deadline Set</option>
                      <option value="locked">Locked</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeadlineFilters({ className: '', examType: '', status: '' })}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  Showing {filteredDeadlines.length} of {deadlines.length} sessions
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">All Exam Sessions</h3>
                <p className="text-sm text-gray-500">These are exam sessions created by teachers. Set deadlines and lock/unlock as needed.</p>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-left font-medium text-gray-600">Class</th>
                        <th className="p-3 text-left font-medium text-gray-600">Exam</th>
                        <th className="p-3 text-left font-medium text-gray-600">Term/Year</th>
                        <th className="p-3 text-left font-medium text-gray-600">Status</th>
                        <th className="p-3 text-left font-medium text-gray-600">Deadline</th>
                        <th className="p-3 text-right font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeadlines.map((d: any) => (
                        <tr key={d.id} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-medium">{d.class_name || 'Unknown'}</td>
                          <td className="p-3">{d.exam_type || '-'}</td>
                          <td className="p-3">{d.term} {d.year}</td>
                          <td className="p-3">
                            {d.is_locked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : d.deadline_date ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700">
                                <Clock className="w-3 h-3" /> Deadline Set
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                <Unlock className="w-3 h-3" /> Open
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {editingDeadlineId === d.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="datetime-local"
                                  value={editingDeadlineValue}
                                  onChange={(e) => setEditingDeadlineValue(e.target.value)}
                                  className="w-48 h-8 text-xs"
                                />
                                <Button size="sm" onClick={() => saveSessionDeadline(d.id)} className="h-8 bg-green-600 hover:bg-green-700">
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEditingDeadlineId(null); setEditingDeadlineValue('') }}
                                  className="h-8"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              d.deadline_date ? (
                                <span className="text-sm">{new Date(d.deadline_date).toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400 text-sm">Not set</span>
                              )
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end flex-wrap md:flex-nowrap">
                              {editingDeadlineId !== d.id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant={d.is_locked ? 'outline' : 'default'}
                                    onClick={() => toggleSessionLock(d.id, d.is_locked)}
                                    className={`${d.is_locked ? '' : 'bg-red-500 hover:bg-red-600'} whitespace-nowrap text-xs md:text-sm px-2 md:px-3`}
                                    title={d.is_locked ? 'Unlock session' : 'Lock session'}
                                  >
                                    {d.is_locked ? (
                                      <><Unlock className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Unlock</span></>
                                    ) : (
                                      <><Lock className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Lock</span></>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setEditingDeadlineId(d.id); setEditingDeadlineValue(d.deadline_date ? new Date(d.deadline_date).toISOString().slice(0, 16) : '') }}
                                    className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3"
                                    title="Set deadline"
                                  >
                                    <Calendar className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Deadline</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => deleteSession(d.id, `${d.class_name || 'Unknown'} - ${d.exam_type || ''} ${d.term} ${d.year}`)}
                                    disabled={deletingSessionId === d.id}
                                    className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                    title="Delete session"
                                  >
                                    {deletingSessionId === d.id ? (
                                      <span className="w-3 h-3 md:w-4 md:h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin md:mr-1" />
                                    ) : (
                                      <Trash2 className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                                    )}
                                    <span className="hidden md:inline">Delete</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDeadlines.length === 0 && deadlines.length > 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            No exam sessions match your filters. Try adjusting your filter criteria.
                          </td>
                        </tr>
                      )}
                      {deadlines.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            No exam sessions created yet. Teachers create sessions when entering marks.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {currentSchool && <MarksEntryTracker schoolId={currentSchool.id} deadlines={deadlines} />}
    </div>
  )
}
