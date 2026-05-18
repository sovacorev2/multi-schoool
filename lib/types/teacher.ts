export interface TeacherAssignment {
  id: string
  class_id: string
  subject_id: string | null
  is_active: boolean
}

export interface TeacherSession {
  teacherId: string
  email: string
  firstName: string
  lastName: string
  schoolId: string
  assignments: TeacherAssignment[]
  assignedClasses: Array<{ id: string; name: string }>
  assignedSubjects: Array<{ id: string; name: string }>
  loginTime: string
}

/**
 * Client-side helper to check if teacher can edit marks
 * Uses session data that's already loaded in localStorage
 */
export function canTeacherEditMarksClient(
  sessionData: TeacherSession | null,
  classId: string,
  subjectId?: string
): boolean {
  if (!sessionData) return false

  // Find matching assignment
  const assignment = sessionData.assignments.find(a => {
    if (a.class_id !== classId) return false
    if (subjectId) {
      return a.subject_id === null || a.subject_id === subjectId
    }
    return true
  })

  return !!assignment
}

/**
 * Get all classes a teacher can edit
 */
export function getTeacherEditableClassesClient(sessionData: TeacherSession | null): string[] {
  if (!sessionData) return []
  return [...new Set(sessionData.assignments.map(a => a.class_id))]
}

/**
 * Get subjects a teacher can edit in a specific class
 */
export function getTeacherSubjectsInClassClient(
  sessionData: TeacherSession | null,
  classId: string
): string[] | null {
  if (!sessionData) return []

  const classAssignments = sessionData.assignments.filter(a => a.class_id === classId)
  
  if (classAssignments.some(a => a.subject_id === null)) {
    return null
  }

  return classAssignments
    .map(a => a.subject_id)
    .filter((id): id is string => id !== null)
}
