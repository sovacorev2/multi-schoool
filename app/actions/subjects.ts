'use server'

import { createClient } from '@/lib/supabase/server'
import { SUBJECT_TEMPLATES } from '@/lib/subject-templates'

export async function seedSchoolSubjects(schoolId: string, gradeLevel: 'grade-1-3' | 'grade-4-6' | 'jss') {
  const supabase = await createClient()

  try {
    // Get subjects for the specified grade level
    const subjectsForLevel = SUBJECT_TEMPLATES.filter(s => s.level === gradeLevel)

    // Insert all subjects for this school
    const { data, error } = await supabase
      .from('subjects')
      .insert(
        subjectsForLevel.map(subject => ({
          name: subject.name,
          code: subject.code,
          school_id: schoolId,
          is_disabled: false,
          is_custom: false,
        }))
      )
      .select()

    if (error) throw error

    return {
      success: true,
      message: `Successfully added ${data?.length || 0} subjects for ${gradeLevel}`,
      subjects: data,
    }
  } catch (error) {
    console.error('[v0] Error seeding subjects:', error)
    return {
      success: false,
      message: 'Failed to seed subjects',
      error: String(error),
    }
  }
}

export async function getSchoolSubjects(schoolId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_disabled', false)
      .order('name')

    if (error) throw error
    return data
  } catch (error) {
    console.error('[v0] Error fetching subjects:', error)
    return []
  }
}
