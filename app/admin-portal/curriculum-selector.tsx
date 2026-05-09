'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SUBJECT_TEMPLATES } from '@/lib/subject-templates'
import { Check, X } from 'lucide-react'

interface CurriculumSelectorProps {
  schoolId?: string
}

export function CurriculumSelector({ schoolId: propSchoolId }: CurriculumSelectorProps) {
  const { currentSchool } = useSchool()
  const schoolId = propSchoolId || currentSchool?.id
  
  const [enabledSubjects, setEnabledSubjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initError, setInitError] = useState<string>('')

  const supabase = createClient()

  // Initialize tables on component mount
  useEffect(() => {
    const initializeTables = async () => {
      try {
        // Try to create tables using raw SQL
        const { error } = await supabase.rpc('execute_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS school_subjects (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
              name text NOT NULL,
              code text NOT NULL,
              is_enabled boolean DEFAULT true,
              created_at timestamp DEFAULT now(),
              UNIQUE(school_id, code)
            );
            
            CREATE TABLE IF NOT EXISTS class_enabled_subjects (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
              subject_code text NOT NULL,
              created_at timestamp DEFAULT now(),
              UNIQUE(class_id, subject_code)
            );
          `
        })
        
        if (error && !error.message?.includes('does not exist')) {
          console.log('[v0] Tables may already exist')
        }
      } catch (e) {
        console.log('[v0] Proceeding with table creation attempt in save')
      }
    }
    
    initializeTables()
  }, [])

  // Group subjects by grade level for display
  const primaryLower = SUBJECT_TEMPLATES.slice(0, 8)
  const primaryUpper = SUBJECT_TEMPLATES.slice(8, 14)
  const secondary = SUBJECT_TEMPLATES.slice(14)

  // Load existing enabled subjects from database
  useEffect(() => {
    if (!schoolId) return
    
    const loadEnabledSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('school_subjects')
          .select('code')
          .eq('school_id', schoolId)
          .eq('is_enabled', true)

        if (error) throw error
        
        const codes = new Set(data?.map(s => s.code) || [])
        setEnabledSubjects(codes)
      } catch (error) {
        console.error('[v0] Error loading subjects:', error)
      }
    }

    loadEnabledSubjects()
  }, [schoolId])

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
    setInitError('')
    try {
      // First, ensure the table exists
      console.log('[v0] Ensuring school_subjects table exists...')
      
      // Try to create if doesn't exist
      const { error: createError } = await supabase
        .from('school_subjects')
        .select('count', { count: 'exact', head: true })
      
      if (createError?.code === 'PGRST116') {
        // Table doesn't exist, try to create it
        console.log('[v0] Creating school_subjects table...')
        const { error: rpcError } = await supabase.rpc('exec_sql', {
          query: `
            CREATE TABLE IF NOT EXISTS school_subjects (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
              name text NOT NULL,
              code text NOT NULL,
              is_enabled boolean DEFAULT true,
              created_at timestamp DEFAULT now(),
              UNIQUE(school_id, code)
            );
          `
        })
        
        if (rpcError) {
          console.log('[v0] RPC call not available, table may exist')
        }
      }

      // Delete all existing subjects for this school
      console.log('[v0] Saving', enabledSubjects.size, 'enabled subjects...')
      const { error: deleteError } = await supabase
        .from('school_subjects')
        .delete()
        .eq('school_id', schoolId)

      if (deleteError) {
        console.error('[v0] Delete error:', deleteError)
        throw deleteError
      }

      // Insert new subjects based on selection
      const subjectsToInsert = SUBJECT_TEMPLATES.map(template => ({
        name: template.name,
        code: template.code,
        school_id: schoolId,
        is_enabled: enabledSubjects.has(template.code)
      }))

      console.log('[v0] Inserting', subjectsToInsert.length, 'subjects...')
      const { error: insertError, data } = await supabase
        .from('school_subjects')
        .insert(subjectsToInsert)

      if (insertError) {
        console.error('[v0] Insert error:', insertError)
        throw insertError
      }

      console.log('[v0] Successfully saved subjects')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      const errorMsg = (error as any)?.message || String(error)
      console.error('[v0] Error saving subjects:', errorMsg)
      setInitError('Error: ' + errorMsg)
      alert('Error saving subjects: ' + errorMsg)
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
        <strong>Real-time Sync:</strong> When you save, teachers&apos; portals update immediately with the enabled subjects.
      </div>
    </div>
  )
}
