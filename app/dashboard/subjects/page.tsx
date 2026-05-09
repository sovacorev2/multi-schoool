'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { Check, X } from 'lucide-react'
import type { Subject } from '@/lib/types'

export default function SubjectsPage() {
  const { currentClass } = useClass()
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchData()

    // Subscribe to real-time changes in school_subjects table
    const channel = supabase
      .channel(`school_subjects:school:${currentClass?.school_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'school_subjects',
          filter: `school_id=eq.${currentClass?.school_id}`
        },
        (payload) => {
          console.log('[v0] School subjects updated in real-time:', payload)
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentClass?.id, currentClass?.school_id])

  const fetchData = async () => {
    if (!currentClass?.school_id) return

    try {
      setIsLoading(true)
      
      // Get all enabled subjects for the school from school_subjects table
      const { data: schoolSubjects, error: subjectsError } = await supabase
        .from('school_subjects')
        .select('*')
        .eq('school_id', currentClass.school_id)
        .eq('is_enabled', true)
        .order('name', { ascending: true })

      if (subjectsError) throw subjectsError
      setAvailableSubjects(schoolSubjects || [])

      // Get currently selected subjects for this class
      const { data: classSubjects, error: classError } = await supabase
        .from('class_enabled_subjects')
        .select('subject_code')
        .eq('class_id', currentClass.id)

      if (classError) throw classError
      setSelectedSubjects((classSubjects || []).map(cs => cs.subject_code))
    } catch (error) {
      console.error('Error fetching subjects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveSelection() {
    if (!currentClass) return

    setIsSaving(true)
    try {
      // Delete existing class subject mappings
      await supabase
        .from('class_enabled_subjects')
        .delete()
        .eq('class_id', currentClass.id)

      // Insert new selections
      if (selectedSubjects.length > 0) {
        const { error } = await supabase
          .from('class_enabled_subjects')
          .insert(
            selectedSubjects.map(subjectCode => ({
              class_id: currentClass.id,
              subject_code: subjectCode
            }))
          )

        if (error) throw error
      }

      setSaveMessage('Subjects saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving subjects:', error)
      setSaveMessage('Error saving subjects')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSubject = (subjectCode: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectCode)
        ? prev.filter(code => code !== subjectCode)
        : [...prev, subjectCode]
    )
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Class Subjects</h1>
        <p className="text-gray-600 mt-2">Select which enabled subjects your class is studying - {currentClass?.name}</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          These are the subjects enabled by your school admin. Select the ones your class is actually studying. Your selection determines which subjects appear in the mark entry interface.
        </p>
      </div>

      {/* Subjects Selection Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Available Subjects</h2>
        
        {availableSubjects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No subjects enabled by admin yet. Contact your school administrator to enable subjects.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {availableSubjects.map(subject => (
                <label
                  key={subject.code}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSubjects.includes(subject.code)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(subject.code)}
                      onChange={() => toggleSubject(subject.code)}
                      className="mt-1 w-5 h-5"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{subject.name}</div>
                      <div className="text-sm text-gray-600 font-mono mt-1">Code: {subject.code}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Summary and Save */}
            <div className="border-t pt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <strong>{selectedSubjects.length}</strong> of <strong>{availableSubjects.length}</strong> subjects selected
              </div>
              <div className="flex items-center gap-3">
                {saveMessage && (
                  <span className={`text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {saveMessage}
                  </span>
                )}
                <button
                  onClick={handleSaveSelection}
                  disabled={isSaving}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Save Selection
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
