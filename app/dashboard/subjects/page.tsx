'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import type { Subject } from '@/lib/types'

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
    fetchSubjects()
    fetchAssignedSubjects()
    fetchSchoolInfo()
  }, [currentClass?.id])

  const fetchSchoolInfo = async () => {
    if (!currentClass?.school_id) return
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('feature_pin_management')
        .eq('id', currentClass.school_id)
        .single()
      
      setPinManagementEnabled(school?.feature_pin_management === true)
    } catch (error) {
      console.error('Error fetching school info:', error)
    }
  }

  async function fetchAssignedSubjects() {
    if (!currentClass) return
    
    // Admin bypass: show all subjects with no teacher filtering
    if (isAdminBypass) {
      setIsClassTeacher(true)  // Admin can edit all
      setAssignedSubjectIds(new Set())  // No filtering
      return
    }

    try {
      // Get teacher context from localStorage (set during PIN auth)
      const teacherId = localStorage.getItem('teacher_id')
      if (!teacherId) return

      // Get assignments for this teacher in this class
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select('subject_id')
        .eq('user_id', teacherId)
        .eq('class_id', currentClass.id)

      if (error) throw error
      
      // Check if teacher is class teacher (has assignment with no subject_id)
      const isClassTeacherAssignment = data?.some(a => !a.subject_id) || false
      setIsClassTeacher(isClassTeacherAssignment)
      
      const assignedIds = new Set(data?.map(a => a.subject_id).filter(Boolean) || [])
      setAssignedSubjectIds(assignedIds)
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
      </div>

      {/* Add Subject Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
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

      {/* Subjects List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Class Subjects ({subjects.length})
          </h2>
        </div>

        {subjects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No subjects added yet. Add your first subject above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-8">
            {subjects.map((subject) => {
              const isAssigned = assignedSubjectIds.has(subject.id)
              
              // If PIN management is enabled (pilot feature active), restrict access
              // Class teachers can edit all subjects, others can only edit assigned ones
              let canEdit = true
              let statusText = ''
              
              if (pinManagementEnabled) {
                // PIN Management enabled: Class teachers can edit all, others only assigned
                canEdit = isClassTeacher || isAssigned
                statusText = isClassTeacher ? 'Class teacher - can edit all' : isAssigned ? 'Assigned to you' : 'Not assigned'
              } else {
                // PIN Management disabled: All teachers can edit all subjects
                canEdit = true
                statusText = ''
              }
              
              return (
                <div
                  key={subject.id}
                  className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg transition-all ${
                    canEdit ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div>
                    <h3 className={`font-semibold ${canEdit ? 'text-gray-900' : 'text-gray-500'}`}>
                      {subject.name}
                    </h3>
                    {statusText && (
                      <p className="text-xs text-gray-500 mt-1">
                        {statusText}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => canEdit && handleEditSubject(subject)}
                      disabled={!canEdit}
                      className={`p-2 rounded-lg transition-colors ${
                        canEdit
                          ? 'text-blue-600 hover:bg-blue-50 cursor-pointer'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                      title={canEdit ? 'Edit subject' : 'Not allowed - not a class teacher'}
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => canEdit && handleDeleteSubject(subject.id)}
                      disabled={!canEdit}
                      className={`p-2 rounded-lg transition-colors ${
                        canEdit
                          ? 'text-red-600 hover:bg-red-50 cursor-pointer'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                      title={canEdit ? 'Delete subject' : 'Not allowed - not a class teacher'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Subject Modal */}
      {showEditModal && editingSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
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
