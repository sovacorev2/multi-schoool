import { cookies } from 'next/headers'

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
 * Get the current teacher's session data
 */
export async function getTeacherSession(): Promise<TeacherSession | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('teacher_session')

    if (!sessionCookie || !sessionCookie.value) {
      return null
    }

    const session = JSON.parse(sessionCookie.value) as TeacherSession
    return session
  } catch (error) {
    console.error('[v0] Error reading teacher session:', error)
    return null
  }
}

/**
 * Check if current user is logged in as a teacher
 */
export async function isTeacherLoggedIn(): Promise<boolean> {
  const session = await getTeacherSession()
  return !!session
}

/**
 * Check if teacher can edit marks for a specific class and subject
 */
export async function canTeacherEditMarks(classId: string, subjectId?: string): Promise<boolean> {
  const session = await getTeacherSession()
  if (!session) return false

  // Find matching assignment
  const assignment = session.assignments.find(a => {
    if (a.class_id !== classId) return false
    // If subject_id is provided, teacher must teach that specific subject OR teach all subjects (subject_id is null)
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
export async function getTeacherEditableClasses(): Promise<string[]> {
  const session = await getTeacherSession()
  if (!session) return []

  return [...new Set(session.assignments.map(a => a.class_id))]
}

/**
 * Get subjects a teacher can edit in a specific class
 * Returns null if teacher teaches all subjects in that class
 */
export async function getTeacherSubjectsInClass(classId: string): Promise<string[] | null> {
  const session = await getTeacherSession()
  if (!session) return []

  const classAssignments = session.assignments.filter(a => a.class_id === classId)
  
  // If any assignment has null subject_id, teacher teaches all subjects
  if (classAssignments.some(a => a.subject_id === null)) {
    return null
  }

  // Return specific subjects
  return classAssignments
    .map(a => a.subject_id)
    .filter((id): id is string => id !== null)
}

/**
 * Clear teacher session (logout)
 */
export async function clearTeacherSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('teacher_session')
}
