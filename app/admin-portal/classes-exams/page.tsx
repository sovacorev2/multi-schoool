'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GraduationCap, Plus, Trash2, Save, Edit, X, ClipboardList } from 'lucide-react'
import type { Class, ExamType } from '@/lib/types'
import { TERMS, sortClasses, getBaseClassName, getUniqueBaseClasses, getStreamsForBaseClass } from '../_shared/utils'

export default function ClassesExamsPage() {
  const { currentSchool } = useSchool()

  const [classes, setClasses] = useState<Class[]>([])
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add class
  const [newClassName, setNewClassName] = useState('')

  // Streams
  const [streamBaseClass, setStreamBaseClass] = useState('')
  const [newStreamName, setNewStreamName] = useState('')
  const [streamError, setStreamError] = useState('')
  const [existingStreams, setExistingStreams] = useState<Class[]>([])

  // Edit class
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [editingClassName, setEditingClassName] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete class
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Exam types
  const [newExamType, setNewExamType] = useState('')
  const [newExamTypeClasses, setNewExamTypeClasses] = useState<string[]>([])
  const [deletingExamTypeId, setDeletingExamTypeId] = useState<string | null>(null)
  const [editingExamTypeId, setEditingExamTypeId] = useState<string | null>(null)
  const [editingExamTypeName, setEditingExamTypeName] = useState('')
  const [editingExamTypeClasses, setEditingExamTypeClasses] = useState<string[]>([])
  const [savingExamTypeEdit, setSavingExamTypeEdit] = useState(false)

  const loadData = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()
    const [classesRes, examTypesRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order'),
      supabase.from('exam_types').select('id, name, display_order, school_id, allowed_class_ids').eq('school_id', currentSchool.id).order('name'),
    ])
    if (classesRes.data) setClasses(sortClasses(classesRes.data as Class[]))
    if (examTypesRes.data) setExamTypes(examTypesRes.data as ExamType[])
    setIsLoading(false)
  }, [currentSchool?.id])

  useEffect(() => { loadData() }, [loadData])

  // --- Classes ---
  const addClass = async () => {
    if (!newClassName.trim() || !currentSchool) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('classes')
      .insert({ name: newClassName.trim(), school_id: currentSchool.id, password: 'welcome', display_order: classes.length + 1 })
      .select()
      .single()

    if (!error && data) {
      const currentYear = new Date().getFullYear()
      const sessionsToInsert = TERMS.map(term => ({
        class_id: data.id, year: currentYear, term, is_active: true, school_id: currentSchool.id,
      }))
      await supabase.from('sessions').insert(sessionsToInsert)
      setClasses(sortClasses([...classes, data as Class]))
      setNewClassName('')
    }
  }

  const startEditClass = (classId: string, className: string) => {
    setEditingClassId(classId)
    setEditingClassName(className)
    setEditError('')
  }

  const cancelEditClass = () => {
    setEditingClassId(null)
    setEditingClassName('')
    setEditError('')
  }

  const saveEditClass = async (classId: string) => {
    if (!editingClassName.trim()) {
      setEditError('Class name cannot be empty')
      return
    }
    setIsSavingEdit(true)
    setEditError('')
    const supabase = createClient()
    const { error } = await supabase.from('classes').update({ name: editingClassName }).eq('id', classId)

    if (error) {
      setEditError(`Failed to update class: ${error.message}`)
      setIsSavingEdit(false)
    } else {
      setClasses(classes.map(c => c.id === classId ? { ...c, name: editingClassName } : c))
      setEditingClassId(null)
      setEditingClassName('')
      setIsSavingEdit(false)
    }
  }

  const handleDeleteClass = (classId: string, className: string) => {
    setClassToDelete({ id: classId, name: className })
    setDeleteConfirmOpen(true)
    setDeleteError('')
  }

  const confirmDeleteClass = async () => {
    if (!classToDelete) return
    setIsDeleting(true)
    setDeleteError('')
    const supabase = createClient()
    const { error } = await supabase.from('classes').delete().eq('id', classToDelete.id)

    if (error) {
      setDeleteError(`Failed to delete class: ${error.message}`)
      setIsDeleting(false)
    } else {
      setClasses(classes.filter(c => c.id !== classToDelete.id))
      setDeleteConfirmOpen(false)
      setClassToDelete(null)
      setIsDeleting(false)
    }
  }

  // --- Streams ---
  const addStreamClass = async () => {
    if (!streamBaseClass || !newStreamName.trim() || !currentSchool) {
      setStreamError('Please select a grade level and enter a stream name')
      return
    }

    const streamClassName = `${streamBaseClass} ${newStreamName.trim().toUpperCase()}`

    if (classes.some(c => c.name.toUpperCase() === streamClassName.toUpperCase())) {
      setStreamError(`Stream "${streamClassName}" already exists`)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('classes')
        .insert({ name: streamClassName, school_id: currentSchool.id, password: 'welcome', display_order: classes.length + 1 })
        .select()
        .single()

      if (error) throw error

      if (data) {
        const currentYear = new Date().getFullYear()
        const sessionsToInsert = TERMS.map(term => ({
          class_id: data.id, year: currentYear, term, is_active: true, school_id: currentSchool.id,
        }))
        await supabase.from('sessions').insert(sessionsToInsert)

        const updatedClasses = sortClasses([...classes, data as Class])
        setClasses(updatedClasses)
        setExistingStreams(getStreamsForBaseClass(updatedClasses, streamBaseClass))
        setNewStreamName('')
        setStreamError('')
      }
    } catch (err: any) {
      setStreamError(err.message || 'Failed to create stream')
    }
  }

  const deleteStream = async (stream: Class) => {
    if (!confirm(`Delete "${stream.name}"?\n\nThis will permanently remove this stream and all associated class data.`)) return
    const supabase = createClient()
    await supabase.from('classes').delete().eq('id', stream.id)
    const updated = classes.filter(c => c.id !== stream.id)
    setClasses(updated)
    setExistingStreams(updated.filter(c => getBaseClassName(c.name) === streamBaseClass))
  }

  // --- Exam types ---
  const addExamType = async () => {
    if (!newExamType.trim() || !currentSchool) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('exam_types')
      .insert({
        name: newExamType.trim(),
        school_id: currentSchool.id,
        allowed_class_ids: newExamTypeClasses.length > 0 ? newExamTypeClasses : null,
      })
      .select()
      .single()

    if (!error && data) {
      setExamTypes([...examTypes, data as ExamType])
      setNewExamType('')
      setNewExamTypeClasses([])
    } else if (error) {
      alert(`Failed to add exam type: ${error.message}`)
    }
  }

  const startEditExamType = (examType: any) => {
    setEditingExamTypeId(examType.id)
    setEditingExamTypeName(examType.name)
    setEditingExamTypeClasses(Array.isArray(examType.allowed_class_ids) ? examType.allowed_class_ids : [])
  }

  const cancelEditExamType = () => {
    setEditingExamTypeId(null)
    setEditingExamTypeName('')
    setEditingExamTypeClasses([])
  }

  const saveEditExamType = async (id: string) => {
    if (!editingExamTypeName.trim()) {
      alert('Exam type name cannot be empty')
      return
    }
    setSavingExamTypeEdit(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('exam_types')
      .update({
        name: editingExamTypeName.trim(),
        allowed_class_ids: editingExamTypeClasses.length > 0 ? editingExamTypeClasses : null,
      })
      .eq('id', id)

    if (error) {
      alert(`Failed to update exam type: ${error.message}`)
      setSavingExamTypeEdit(false)
      return
    }
    setExamTypes(examTypes.map(e => e.id === id
      ? { ...e, name: editingExamTypeName.trim(), allowed_class_ids: editingExamTypeClasses.length > 0 ? editingExamTypeClasses : null } as ExamType
      : e))
    setSavingExamTypeEdit(false)
    cancelEditExamType()
  }

  const deleteExamType = async (id: string) => {
    try {
      const examTypeName = examTypes.find(e => e.id === id)?.name || 'Unknown'
      const supabase = createClient()

      const confirmMessage = `Are you sure you want to delete "${examTypeName}"?\n\nThis will also delete all associated exam sessions and marks.\n\nThis action cannot be undone.`
      if (!confirm(confirmMessage)) return

      setDeletingExamTypeId(id)

      const { data: sessionsToDelete } = await supabase.from('sessions').select('id').eq('exam_type_id', id)
      const sessionIds = sessionsToDelete?.map((s: { id: string }) => s.id) || []

      if (sessionIds.length > 0) {
        for (const sessionId of sessionIds) {
          await supabase.from('audit_logs').delete().eq('session_id', sessionId)
        }
        for (const sessionId of sessionIds) {
          await supabase.from('marks').delete().eq('session_id', sessionId)
        }
      }

      try {
        await supabase.from('analytics_sessions').delete().eq('exam_type_id', id)
      } catch {
        // non-fatal
      }

      if (sessionIds.length > 0) {
        for (const sessionId of sessionIds) {
          const { error: delErr } = await supabase.from('sessions').delete().eq('id', sessionId)
          if (delErr) throw delErr
        }
      }

      const { error: examTypeError } = await supabase
        .from('exam_types')
        .delete()
        .eq('id', id)
        .eq('school_id', currentSchool?.id)

      if (examTypeError) {
        const errorDetail = examTypeError.message || 'Unknown error'
        if (errorDetail.includes('foreign key')) {
          alert(`Cannot delete "${examTypeName}" because it is used by exam sessions.\n\nPlease delete the sessions first, then delete the exam type.`)
        } else {
          alert(`Failed to delete exam type: ${errorDetail}`)
        }
        setDeletingExamTypeId(null)
        return
      }

      setExamTypes(examTypes.filter(e => e.id !== id))
      setDeletingExamTypeId(null)
      alert(`Exam type "${examTypeName}" has been deleted successfully.`)
    } catch (error) {
      alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`)
      setDeletingExamTypeId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Manage Classes
          </CardTitle>
          <CardDescription>Add, remove, or create stream variants for classes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="Enter class name (e.g., Grade 10, Form 1)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addClass()}
            />
            <Button onClick={addClass} disabled={!newClassName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Class
            </Button>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <div>
              <h3 className="font-medium text-blue-900">Manage Streams</h3>
              <p className="text-xs text-blue-700 mt-1">Add or remove streams for grade levels</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Select Grade Level</label>
              <Select value={streamBaseClass} onValueChange={(value) => {
                setStreamBaseClass(value)
                setStreamError('')
                setNewStreamName('')
                setExistingStreams(getStreamsForBaseClass(classes, value))
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a grade level..." />
                </SelectTrigger>
                <SelectContent>
                  {getUniqueBaseClasses(classes).map(baseClass => (
                    <SelectItem key={baseClass.name} value={baseClass.name}>
                      {baseClass.name} {baseClass.streamCount > 1 ? `(${baseClass.streamCount} streams)` : '(no streams)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {streamBaseClass && (
              <div className="space-y-3 p-3 bg-white rounded border">
                {existingStreams.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Existing Streams</p>
                    <div className="flex flex-wrap gap-2">
                      {existingStreams.map(stream => {
                        const streamName = stream.name.replace(streamBaseClass, '').trim()
                        return (
                          <div key={stream.id} className="flex items-center gap-2 px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg text-sm">
                            <span className="font-medium">{streamBaseClass} {streamName}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteStream(stream)}
                              className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Add New Stream</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Stream name (e.g., EAST, WEST, A, B)"
                      value={newStreamName}
                      onChange={(e) => { setNewStreamName(e.target.value); setStreamError('') }}
                    />
                    <Button onClick={addStreamClass} disabled={!newStreamName.trim()} size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {streamError && (
              <div className="text-red-700 text-sm p-3 bg-red-100 rounded border border-red-300">
                ⚠️ {streamError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sortClasses(classes).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                {editingClassId === c.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editingClassName}
                      onChange={(e) => setEditingClassName(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Class name"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => saveEditClass(c.id)} disabled={isSavingEdit} className="h-8">
                      {isSavingEdit ? '...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditClass} disabled={isSavingEdit} className="h-8">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-sm">{c.name}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEditClass(c.id, c.name)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteClass(c.id, c.name)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {editError && (
            <div className="text-red-600 text-sm p-3 bg-red-50 rounded border border-red-200">
              {editError}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Manage Exam Types
          </CardTitle>
          <CardDescription>Add custom exam types like CAT, Weekly Test, etc. Choose which classes each exam type is available for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div>
              <Label className="text-xs">Exam Type Name</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., CAT 1, Weekly Test, JSS End Term"
                  value={newExamType}
                  onChange={(e) => setNewExamType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExamType()}
                  className="text-sm"
                />
                <Button onClick={addExamType} disabled={!newExamType.trim()} className="whitespace-nowrap">
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Available for classes</Label>
              <p className="text-xs text-gray-500 mb-2">
                Leave all unchecked to make this exam type available to <strong>all classes</strong>. Otherwise, tick only the classes that should see it (e.g. tick Grade 7-9 for a JSS-only exam).
              </p>
              <div className="flex flex-wrap gap-2">
                {classes.map((cls) => {
                  const checked = newExamTypeClasses.includes(cls.id)
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setNewExamTypeClasses(checked ? newExamTypeClasses.filter(id => id !== cls.id) : [...newExamTypeClasses, cls.id])}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}
                    >
                      {cls.name}
                    </button>
                  )
                })}
              </div>
              {newExamTypeClasses.length === 0 && (
                <p className="text-xs text-blue-700 mt-2">Currently available to: <strong>All classes</strong></p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 p-3 bg-gray-100 rounded-lg font-semibold text-sm">
              <span className="col-span-4">Exam Type</span>
              <span className="col-span-6">Available For</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>
            {examTypes.map(e => {
              const allowed: string[] = Array.isArray((e as any).allowed_class_ids) ? (e as any).allowed_class_ids : []
              const isEditing = editingExamTypeId === e.id
              return (
                <div key={e.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editingExamTypeName}
                        onChange={(ev) => setEditingExamTypeName(ev.target.value)}
                        className="text-sm"
                        placeholder="Exam type name"
                      />
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Tick classes this exam type applies to (none = all classes):</p>
                        <div className="flex flex-wrap gap-2">
                          {classes.map((cls) => {
                            const checked = editingExamTypeClasses.includes(cls.id)
                            return (
                              <button
                                key={cls.id}
                                type="button"
                                onClick={() => setEditingExamTypeClasses(checked ? editingExamTypeClasses.filter(id => id !== cls.id) : [...editingExamTypeClasses, cls.id])}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}
                              >
                                {cls.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEditExamType(e.id)} disabled={savingExamTypeEdit} className="bg-green-600 hover:bg-green-700">
                          <Save className="w-4 h-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditExamType} disabled={savingExamTypeEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 font-medium">{e.name}</span>
                      <span className="col-span-6 text-gray-600 text-xs">
                        {allowed.length === 0
                          ? 'All classes'
                          : allowed.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(', ') || 'All classes'}
                      </span>
                      <div className="col-span-2 flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEditExamType(e)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Edit exam type">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExamType(e.id)}
                          disabled={deletingExamTypeId === e.id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete exam type"
                        >
                          {deletingExamTypeId === e.id ? (
                            <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the class <strong>{classToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="text-red-600 text-sm p-2 bg-red-50 rounded border border-red-200">
              {deleteError}
            </div>
          )}
          <div className="flex gap-3 justify-end mt-4">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button onClick={confirmDeleteClass} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Deleting...' : 'Delete Class'}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
