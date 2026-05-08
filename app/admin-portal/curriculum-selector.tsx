'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SUBJECT_TEMPLATES } from '@/lib/subject-templates'
import { Check, X } from 'lucide-react'

interface CurriculumSelectorProps {
  schoolId?: string
}

export function CurriculumSelector({ schoolId }: CurriculumSelectorProps) {
  const [enabledSubjects, setEnabledSubjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  // Group subjects by grade level for display
  const primaryLower = SUBJECT_TEMPLATES.slice(0, 8)
  const primaryUpper = SUBJECT_TEMPLATES.slice(8, 14)
  const secondary = SUBJECT_TEMPLATES.slice(14)

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
    setLoading(true)
    try {
      // Store in localStorage for now since we don't have global_subjects table yet
      localStorage.setItem('enabledSubjects', JSON.stringify(Array.from(enabledSubjects)))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('[v0] Error saving subjects:', error)
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

      {/* Summary */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-900">
              {enabledSubjects.size} subject{enabledSubjects.size !== 1 ? 's' : ''} selected
            </p>
            <p className="text-sm text-blue-800 mt-1">
              Teachers will see only enabled subjects in their portal. They can select which ones they teach for each class.
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
                Saved
              </>
            ) : (
              'Save Selection'
            )}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
        <strong>Note:</strong> Subject configuration will be stored and used to populate the teacher portal. Teachers can then select which of these enabled subjects they teach in each class.
      </div>
    </div>
  )
}
