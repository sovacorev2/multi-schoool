'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import type { Subject } from '@/lib/types'
import { getStoredTeacherId } from '@/lib/teacher-permissions'

export default function SubjectsPage() {
  const { currentClass, isAdminBypass } = useClass()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<Set<string>>(new Set())
  const [isClassTeacher, setIsClassTeacher] = useState(false)
  const [pinManagementEnabled, setPinManagementEnabled] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit state
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!currentClass?.id) return
    loadPageData()
  }, [currentClass?.id, isAdminBypass])

  // Single sequential loader: school info first, then conditionally assignments
  const loadPageData = async () => {
    if (!currentClass) return

    // Step 1: fetch subjects (can run immediately, no dependencies)
    fetchSubjects()

    // Step 2: check if school has PIN management enabled
    const schoolId = currentClass.school_id
    let hasPinManagement = false

    if (schoolId) {
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('feature_pin_management')
          .eq('id', schoolId)
          .single()
        hasPinManagement = school?.feature_pin_management === true
      } catch {
        hasPinManagement = false
      }
    }

    setPinManagementEnabled(hasPinManagement)

    // Step 3: decide restrictions based on school setting
    if (!hasPinManagement) {
      // Non-PIN school: full access, no restrictions, no labels
      setIsClassTeacher(true)
      setAssignedSubjectIds(new Set())
      return
    }

    // Step 4: PIN-enabled school - apply restrictions
    if (isAdminBypass) {
      setIsClassTeacher(true)
      setAssignedSubjectIds(new Set())
      return
    }

    const teacherId = getStoredTeacherId()
    if (!teacherId) {
      setIsClassTeacher(false)
      setAssignedSubjectIds(new Set())
      return
    }

    try {
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select('subject_id')
        .eq('user_id', teacherId)
        .eq('class_id', currentClass.id)

      if (error) throw error

      const isClassTeacherAssignment = data?.some(a => !a.subject_id) || false
      setIsClassTeacher(isClassTeacherAssignment)
      setAssignedSubjectIds(new Set(data?.map(a => a.subject_id).filter(Boolean) || []))
    } catch (error) {
      console.error('Error fetching assigned subjects:', error)
    }
  }

  async function fetchSubjects() {
    if (!currentClass) return

    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', currentClass.id)
        .order('name', { ascending: true })

      if (error) throw error
      setSubjects(data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!subjectName.trim() || !currentClass) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert([
          {
            name: subjectName.trim().toUpperCase(),
            class_id: currentClass.id,
            is_custom: true,
          },
        ])
        .select()

      if (error) throw error
      if (data) {
        setSubjects([...subjects, data[0]])
        setSubjectName('')
      }
    } catch (error) {
      console.error('Error adding subject:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteSubject(subjectId: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return

    try {
      const { error } = await supabase.from('subjects').delete().eq('id', subjectId)
      if (error) throw error
      setSubjects(subjects.filter((s) => s.id !== subjectId))
    } catch (error) {
      console.error('Error deleting subject:', error)
    }
  }

  async function handleEditSubject(subject: Subject) {
    setEditingSubject(subject)
    setEditingName(subject.name)
    setShowEditModal(true)
  }

  async function handleUpdateSubject() {
    if (!editingSubject || !editingName.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: editingName.trim().toUpperCase(),
        })
        .eq('id', editingSubject.id)

      if (error) throw error

      setSubjects(
        subjects.map((s) =>
          s.id === editingSubject.id ? { ...s, name: editingName.trim().toUpperCase() } : s,
        ),
      )
      setShowEditModal(false)
      setEditingSubject(null)
      setEditingName('')
    } catch (error) {
      console.error('Error updating subject:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Subjects</h1>
        <p className="text-gray-600 mt-2">Add and manage subjects for {currentClass?.name}</p>
        
        {/* PIN Teacher Info */}
        {pinManagementEnabled && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Subject Restrictions Active:</span> You can only edit and manage subjects you are assigned to teach.
            </p>
          </div>
        )}
      </div>

      {/* Add Subject Form - Hidden only for PIN subject-teachers (not class teachers, not admins) */}
      {(!pinManagementEnabled || isAdminBypass || isClassTeacher) && (
        <div className="bg-card dark:bg-card rounded-lg shadow-sm border border-border dark:border-border p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Add New Subject</h2>
          
          <form onSubmit={handleAddSubject} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subject Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name</label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g., Mathematics, English, Science"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Add Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !subjectName.trim()}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  <Plus className="w-5 h-5 inline-block mr-2" />
                  Add Subject
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Subjects List */}
      <div className="bg-card dark:bg-card rounded-lg shadow-sm border border-border dark:border-border overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Class Subjects ({subjects.length})
          </h2>
        </div>

        {(() => {
          // Filter subjects based on PIN management
          let displayedSubjects = subjects
          if (pinManagementEnabled && !isClassTeacher) {
            // PIN teacher (not class teacher): show ONLY assigned subjects
            displayedSubjects = subjects.filter(s => assignedSubjectIds.has(s.id))
          }
          // Admin or non-PIN teacher: show all subjects
          
          return displayedSubjects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {pinManagementEnabled && !isClassTeacher 
                ? 'No subjects assigned to you in this class.'
                : 'No subjects added yet. Add your first subject above.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-8">
              {displayedSubjects.map((subject) => {
                const isAssigned = assignedSubjectIds.has(subject.id)
                
                // PIN teacher: only show assigned subjects (all can be edited)
                // Admin/non-PIN teacher: show all subjects (all can be edited)
                const canEdit = true
                // Only show assignment labels for PIN-enabled schools
                // Non-PIN schools: no label (no assignments, no restrictions)
                const statusText = !pinManagementEnabled 
                  ? '' 
                  : isClassTeacher 
                    ? 'Class teacher - can edit all' 
                    : 'Assigned to you'
                
                return (
                  <div
                    key={subject.id}
                    className={`flex items-center justify-between p-4 border border-border dark:border-border rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-slate-700`}
                  >
                    <div>
                      <h3 className={`font-semibold text-foreground dark:text-foreground`}>
                        {subject.name}
                      </h3>
                      {statusText && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {statusText}
                        </p>
                    )}
                  </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSubject(subject)}
                        className="p-2 rounded-lg transition-colors text-primary dark:text-accent hover:bg-primary/10 dark:hover:bg-accent/10 cursor-pointer"
                        title="Edit subject"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="p-2 rounded-lg transition-colors text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Delete subject"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Edit Subject Modal */}
      {showEditModal && editingSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card dark:bg-card rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Subject Name</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name</label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Subject name"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSubject(null)
                  setEditingName('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubject}
                disabled={isSubmitting || !editingName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
