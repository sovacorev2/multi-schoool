import { createClient } from '@/lib/supabase/client'

export interface TeacherAssignment {
  id: string
  class_id: string
  subject_id: string | null
  is_active: boolean
}

/**
 * Check if a teacher can edit marks for a specific class and subject
 * Teachers can edit if:
 * - They have an active assignment for that class
 * - AND (the assignment has no subject restriction OR the subject matches)
 */
export async function canTeacherEditMarks(
  userId: string,
  schoolId: string,
  classId: string,
  subjectId: string
): Promise<boolean> {
  try {
    const supabase = createClient()

    const { data: assignments, error } = await supabase
      .from('teacher_assignments')
      .select('id, class_id, subject_id, is_active')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('is_active', true)

    if (error) {
      console.error('[v0] Error checking teacher permissions:', error)
      return false
    }

    if (!assignments || assignments.length === 0) {
      console.log('[v0] No assignments found for teacher', userId, 'in class', classId)
      return false
    }

    // Check if teacher has permission for this subject
    // They can edit if:
    // 1. They have a subject-specific assignment that matches
    // 2. OR they have a class-wide assignment (subject_id is NULL)
    const hasPermission = assignments.some(assignment => {
      return assignment.subject_id === null || assignment.subject_id === subjectId
    })

    console.log('[v0] Teacher permission check:', { userId, classId, subjectId, hasPermission })
    return hasPermission
  } catch (err) {
    console.error('[v0] Teacher permission check error:', err)
    return false
  }
}

/**
 * Get all classes a teacher is assigned to
 */
export async function getTeacherAssignedClasses(
  userId: string,
  schoolId: string
): Promise<string[]> {
  try {
    const supabase = createClient()

    const { data: assignments, error } = await supabase
      .from('teacher_assignments')
      .select('class_id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)

    if (error || !assignments) return []

    return [...new Set(assignments.map(a => a.class_id))]
  } catch (err) {
    console.error('[v0] Error getting teacher classes:', err)
    return []
  }
}

/**
 * Get all subjects a teacher can edit in a specific class
 * Returns array of subject IDs
 * If teacher teaches all subjects in the class, returns null
 */
export async function getTeacherSubjectsInClass(
  userId: string,
  schoolId: string,
  classId: string
): Promise<string[] | null> {
  try {
    const supabase = createClient()

    const { data: assignments, error } = await supabase
      .from('teacher_assignments')
      .select('subject_id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('is_active', true)

    if (error || !assignments) return []

    // If any assignment has NULL subject_id, teacher teaches all subjects
    if (assignments.some(a => a.subject_id === null)) {
      return null
    }

    // Otherwise return specific subject IDs
    return assignments.map(a => a.subject_id).filter(Boolean) as string[]
  } catch (err) {
    console.error('[v0] Error getting teacher subjects:', err)
    return []
  }
}

/**
 * Check if teacher can view a class (can view all, but can only edit assigned ones)
 */
export async function canTeacherViewClass(
  userId: string,
  schoolId: string
): Promise<boolean> {
  try {
    const supabase = createClient()

    const { data: assignments, error } = await supabase
      .from('teacher_assignments')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(1)

    if (error) return false
    return assignments && assignments.length > 0
  } catch (err) {
    console.error('[v0] Error checking teacher view access:', err)
    return false
  }
}
