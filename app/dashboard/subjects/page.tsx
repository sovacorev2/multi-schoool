'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import type { Subject } from '@/lib/types'

export default function SubjectsPage() {
  const { currentClass } = useClass()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchSubjects()
  }, [currentClass?.id])

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

  async function handleEditStart(subject: Subject) {
    setEditingId(subject.id)
    setEditingName(subject.name)
  }

  async function handleSaveEdit(subjectId: string) {
    if (!editingName.trim()) {
      setEditingId(null)
      return
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name: editingName.trim().toUpperCase() })
        .eq('id', subjectId)

      if (error) throw error
      
      setSubjects(subjects.map(s => 
        s.id === subjectId ? { ...s, name: editingName.trim().toUpperCase() } : s
      ))
      setEditingId(null)
      setEditingName('')
    } catch (error) {
      console.error('Error updating subject:', error)
    }
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditingName('')
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
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {editingId === subject.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(subject.id)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-gray-900">{subject.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Custom</p>
                  </div>
                )}
                <div className="flex items-center gap-2 ml-2">
                  {editingId === subject.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(subject.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Save"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditStart(subject)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit subject"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete subject"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
