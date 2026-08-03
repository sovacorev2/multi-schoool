'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'

interface SubjectRow {
  subjectId: string
  subjectName: string
  teacherName: string | null
  overrideId: string | null
  overrideDeadline: string | null // ISO string, for the datetime-local input
}

export function TeacherDeadlineDialog({
  open,
  onOpenChange,
  sessionId,
  classId,
  sessionLabel,
  classDeadline,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  classId: string
  sessionLabel: string
  classDeadline: string // already-formatted display string, e.g. "Not set" or a locale date
}) {
  const [rows, setRows] = useState<SubjectRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    load()
  }, [open, sessionId, classId])

  const load = async () => {
    setIsLoading(true)
    const supabase = createClient()

    const [subjectsRes, assignmentsRes, overridesRes] = await Promise.all([
      supabase.from('subjects').select('id, name').eq('class_id', classId).order('name'),
      supabase.from('teacher_assignments').select('user_id, subject_id').eq('class_id', classId).eq('is_active', true).not('subject_id', 'is', null),
      supabase.from('teacher_deadline_overrides').select('*').eq('session_id', sessionId),
    ])

    const subjects = subjectsRes.data || []
    const assignments = assignmentsRes.data || []
    const overrides = overridesRes.data || []

    const teacherIds = [...new Set(assignments.map((a: any) => a.user_id))]
    const { data: teachers } = teacherIds.length > 0
      ? await supabase.from('teacher_accounts').select('id, first_name, last_name').in('id', teacherIds)
      : { data: [] as any[] }

    const teacherNameById = new Map((teachers || []).map((t: any) => [t.id, [t.first_name, t.last_name].filter(Boolean).join(' ')]))
    const teacherBySubject = new Map(assignments.map((a: any) => [a.subject_id, teacherNameById.get(a.user_id) || null]))
    const overrideBySubject = new Map(overrides.map((o: any) => [o.subject_id, o]))

    setRows(subjects.map((s: any) => {
      const override = overrideBySubject.get(s.id) as any
      return {
        subjectId: s.id,
        subjectName: s.name,
        teacherName: teacherBySubject.get(s.id) || null,
        overrideId: override?.id || null,
        overrideDeadline: override?.deadline_datetime || null,
      }
    }))
    setIsLoading(false)
  }

  const saveOverride = async (subjectId: string) => {
    const value = editValues[subjectId]
    if (!value) return
    setSavingSubjectId(subjectId)
    const supabase = createClient()
    const isoValue = new Date(value).toISOString()

    const { error } = await supabase
      .from('teacher_deadline_overrides')
      .upsert({ session_id: sessionId, subject_id: subjectId, deadline_datetime: isoValue }, { onConflict: 'session_id,subject_id' })

    if (error) {
      alert(`Failed to save deadline: ${error.message}`)
    } else {
      await load()
      setEditValues(prev => ({ ...prev, [subjectId]: '' }))
    }
    setSavingSubjectId(null)
  }

  const clearOverride = async (subjectId: string) => {
    setSavingSubjectId(subjectId)
    const supabase = createClient()
    const { error } = await supabase
      .from('teacher_deadline_overrides')
      .delete()
      .eq('session_id', sessionId)
      .eq('subject_id', subjectId)

    if (error) {
      alert(`Failed to clear override: ${error.message}`)
    } else {
      await load()
    }
    setSavingSubjectId(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Per-Teacher Deadlines</DialogTitle>
          <DialogDescription>
            {sessionLabel} &bull; Class deadline: {classDeadline}. Give an individual subject teacher a different deadline without changing the rest of the class.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2 text-left">Teacher</th>
                  <th className="p-2 text-left">Override Deadline</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.subjectId} className="border-t">
                    <td className="p-2 font-medium">{row.subjectName}</td>
                    <td className="p-2 text-gray-600">{row.teacherName || 'Not assigned'}</td>
                    <td className="p-2">
                      {row.overrideDeadline ? (
                        <span className="text-amber-700 text-xs font-medium">
                          {new Date(row.overrideDeadline).toLocaleString()}
                        </span>
                      ) : (
                        <Input
                          type="datetime-local"
                          className="h-8 text-xs w-48"
                          value={editValues[row.subjectId] || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [row.subjectId]: e.target.value }))}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {row.overrideDeadline ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => clearOverride(row.subjectId)}
                          disabled={savingSubjectId === row.subjectId}
                          className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Clear
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => saveOverride(row.subjectId)}
                          disabled={!editValues[row.subjectId] || savingSubjectId === row.subjectId}
                          className="h-8"
                        >
                          Set
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-400">No subjects configured for this class</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
