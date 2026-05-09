'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SUBJECT_TEMPLATES } from '@/lib/subject-templates'
import { Check, X, Plus } from 'lucide-react'

interface CurriculumSelectorProps {
  schoolId?: string
}

export function CurriculumSelector({ schoolId: propSchoolId }: CurriculumSelectorProps) {
  const { currentSchool } = useSchool()
  const schoolId = propSchoolId || currentSchool?.id
  
  const [enabledSubjects, setEnabledSubjects] = useState<Set<string>>(new Set())
  const [customSubjects, setCustomSubjects] = useState<Array<{id: string, name: string, code: string}>>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [customError, setCustomError] = useState('')

  const supabase = createClient()

  // Group subjects by grade level for display
  const primaryLower = SUBJECT_TEMPLATES.slice(0, 8)
  const primaryUpper = SUBJECT_TEMPLATES.slice(8, 14)
  const secondary = SUBJECT_TEMPLATES.slice(14)

  // Load existing subjects from database
  useEffect(() => {
    if (!schoolId) return
    
    const loadSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('school_subjects')
          .select('code, is_enabled, is_custom, name, id')
          .eq('school_id', schoolId)

        if (error) throw error
        
        const enabled = new Set<string>()
        const custom: Array<{id: string, name: string, code: string}> = []
        
        data?.forEach(s => {
          if (s.is_enabled) {
            enabled.add(s.code)
          }
          if (s.is_custom) {
            custom.push({id: s.id, name: s.name, code: s.code})
          }
        })
        
        setEnabledSubjects(enabled)
        setCustomSubjects(custom)
      } catch (error) {
        console.error('[v0] Error loading subjects:', error)
      }
    }

    loadSubjects()
  }, [schoolId])

  // Check if code already exists
  const codeExists = (code: string) => {
    const allCodes = [
      ...SUBJECT_TEMPLATES.map(s => s.code),
      ...customSubjects.map(s => s.code)
    ]
    return allCodes.includes(code.toUpperCase())
  }

  const addCustomSubject = async () => {
    setCustomError('')
    
    // Validation
    if (!customName.trim()) {
      setCustomError('Subject name is required')
      return
    }
    
    if (!customCode.trim()) {
      setCustomError('Subject code is required')
      return
    }

    const code = customCode.toUpperCase().trim()
    
    if (code.length > 10) {
      setCustomError('Code must be 10 characters or less')
      return
    }

    if (codeExists(code)) {
      setCustomError(`Code "${code}" already exists. Choose a unique code.`)
      return
    }

    try {
      // Insert custom subject
      const { data, error } = await supabase
        .from('school_subjects')
        .insert({
          school_id: schoolId,
          name: customName.trim(),
          code: code,
          is_enabled: true,
          is_custom: true
        })
        .select()

      if (error) throw error

      // Add to custom subjects list
      if (data && data[0]) {
        setCustomSubjects([...customSubjects, {
          id: data[0].id,
          name: data[0].name,
          code: data[0].code
        }])
        setEnabledSubjects(new Set([...Array.from(enabledSubjects), code]))
      }

      // Clear form
      setCustomName('')
      setCustomCode('')
      setShowCustomForm(false)
    } catch (error) {
      console.error('[v0] Error adding custom subject:', error)
      setCustomError('Failed to add custom subject: ' + (error as any)?.message)
    }
  }

  const removeCustomSubject = async (subjectId: string, code: string) => {
    try {
      const { error } = await supabase
        .from('school_subjects')
        .delete()
        .eq('id', subjectId)

      if (error) throw error

      setCustomSubjects(customSubjects.filter(s => s.id !== subjectId))
      const newEnabled = new Set(enabledSubjects)
      newEnabled.delete(code)
      setEnabledSubjects(newEnabled)
    } catch (error) {
      console.error('[v0] Error removing custom subject:', error)
      alert('Failed to remove subject: ' + (error as any)?.message)
    }
  }

  const toggleSubject = (code: string) => {
    const newSet = new Set(enabledSubjects)
    if (newSet.has(code)) {
      newSet.delete(code)
    } else {
      newSet.add(code)
    }
    setEnabledSubjects(newSet)
    setSaved(false)
  }

  const enableAllInGroup = (subjects: typeof SUBJECT_TEMPLATES) => {
    const newSet = new Set(enabledSubjects)
    subjects.forEach(s => newSet.add(s.code))
    setEnabledSubjects(newSet)
    setSaved(false)
  }

  const disableAllInGroup = (subjects: typeof SUBJECT_TEMPLATES) => {
    const newSet = new Set(enabledSubjects)
    subjects.forEach(s => newSet.delete(s.code))
    setEnabledSubjects(newSet)
    setSaved(false)
  }

  const saveSelection = async () => {
    if (!schoolId) return
    
    setLoading(true)
    try {
      // Delete all existing non-custom subjects for this school
      const { error: deleteError } = await supabase
        .from('school_subjects')
        .delete()
        .eq('school_id', schoolId)
        .eq('is_custom', false)

      if (deleteError) throw deleteError

      // Insert template subjects based on selection
      const subjectsToInsert = SUBJECT_TEMPLATES.map(template => ({
        name: template.name,
        code: template.code,
        school_id: schoolId,
        is_enabled: enabledSubjects.has(template.code),
        is_custom: false
      }))

      const { error: insertError } = await supabase
        .from('school_subjects')
        .insert(subjectsToInsert)

      if (insertError) throw insertError

      // Update custom subjects enable status
      for (const custom of customSubjects) {
        const { error: updateError } = await supabase
          .from('school_subjects')
          .update({ is_enabled: enabledSubjects.has(custom.code) })
          .eq('id', custom.id)

        if (updateError) throw updateError
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('[v0] Error saving subjects:', error)
      alert('Error saving subjects: ' + (error as any)?.message)
    } finally {
      setLoading(false)
    }
  }

  // Render subject group
  const renderGroup = (title: string, subjects: typeof SUBJECT_TEMPLATES, allInGroup: typeof SUBJECT_TEMPLATES) => (
    <div key={title} className="space-y-3 p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => enableAllInGroup(allInGroup)}
            className="text-xs h-7"
          >
            Enable All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => disableAllInGroup(allInGroup)}
            className="text-xs h-7 text-red-600 hover:text-red-700"
          >
            Disable All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {subjects.map(subject => (
          <div
            key={subject.code}
            className={`p-3 rounded border-2 cursor-pointer transition-all ${
              enabledSubjects.has(subject.code)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => toggleSubject(subject.code)}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={enabledSubjects.has(subject.code)}
                onChange={() => toggleSubject(subject.code)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 line-clamp-2">
                  {subject.name}
                </div>
                <div className="text-xs text-gray-600 font-mono mt-1">
                  {subject.code}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {renderGroup('PP1-Grade 3 (Primary Lower)', primaryLower, primaryLower)}
        {renderGroup('Grade 4-6 (Primary Upper)', primaryUpper, primaryUpper)}
        {renderGroup('Grade 7-9 (Secondary/JSS)', secondary, secondary)}
      </div>

      {/* Custom Subjects Section */}
      <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Custom Subjects</h3>
          <Button
            size="sm"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Custom Subject
          </Button>
        </div>

        {showCustomForm && (
          <div className="space-y-3 mb-4 p-3 bg-white rounded border border-purple-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Computer Science"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject Code (unique)
              </label>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="e.g., COMP-SCI"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Max 10 characters. Must be unique.</p>
            </div>
            {customError && (
              <div className="p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                {customError}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={addCustomSubject}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Add Subject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCustomForm(false)
                  setCustomError('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {customSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {customSubjects.map(subject => (
              <div
                key={subject.id}
                className={`p-3 rounded border-2 transition-all ${
                  enabledSubjects.has(subject.code)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={enabledSubjects.has(subject.code)}
                    onChange={() => toggleSubject(subject.code)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                      {subject.name}
                    </div>
                    <div className="text-xs text-gray-600 font-mono mt-1">
                      {subject.code}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCustomSubject(subject.id, subject.code)}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No custom subjects added yet.</p>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-900">
              {enabledSubjects.size} subject{enabledSubjects.size !== 1 ? 's' : ''} selected ({customSubjects.filter(s => enabledSubjects.has(s.code)).length} custom)
            </p>
            <p className="text-sm text-blue-800 mt-1">
              Teachers will see only enabled subjects in their portal. Changes appear immediately.
            </p>
          </div>
          <Button
            onClick={saveSelection}
            disabled={loading || enabledSubjects.size === 0}
            className={`${
              saved
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              'Save Selection'
            )}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
        <strong>Real-time Sync:</strong> When you save, teachers&apos; portals update immediately with the enabled subjects including any custom subjects you&apos;ve added.
      </div>
    </div>
  )
}
