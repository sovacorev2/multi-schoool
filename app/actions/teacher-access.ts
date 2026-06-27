'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * CRITICAL: Get teacher's allowed classes and subjects from database
 * This enforces subject restrictions - teachers can ONLY access assigned subjects
 *
 * ACTUAL DATABASE SCHEMA (verified live):
 *   teacher_assignments: id, school_id, user_id (TEACHER), class_id, subject_id (nullable), assigned_at, is_active, created_at
 *   subjects:            id, class_id, name, is_custom, created_at, school_id
 *   classes:             id, name, code, display_order, teacher_name, password, created_at, school_id
 */
export async function getTeacherAssignedClasses(teacherId: string) {
  console.log('[v0] Fetching assignments for teacher:', teacherId)

  const supabase = await createClient()

  // Get all assignments for this teacher.
  // NOTE: teacher column is `user_id`, subject label column is `name`.
  const { data: assignments, error } = await supabase
    .from('teacher_assignments')
    .select(`
      id,
      user_id,
      class_id,
      subject_id,
      classes:class_id ( id, name, school_id ),
      subjects:subject_id ( id, name )
    `)
    .eq('user_id', teacherId)

  if (error) {
    console.error('[v0] Error fetching assignments:', error.message)
    return { success: false, error: error.message, classes: [] }
  }

  console.log(`[v0] Found ${assignments?.length || 0} assignments`)

  // Group by class
  const classMap = new Map<string, any>()

  assignments?.forEach((assignment: any) => {
    const classId = assignment.class_id
    const classInfo = assignment.classes as any

    if (!classMap.has(classId)) {
      classMap.set(classId, {
        id: classId,
        name: classInfo?.name || 'Unknown',
        schoolId: classInfo?.school_id,
        subjects: [],
        isClassTeacher: false,
        allSubjects: [], // Track which subject IDs this teacher can edit
      })
    }

    const cls = classMap.get(classId)

    // subject_id = NULL means this teacher is the class teacher (can edit all subjects)
    if (!assignment.subject_id) {
      cls.isClassTeacher = true
      console.log(`[v0] ${teacherId} is CLASS TEACHER for ${classInfo?.name}`)
    } else {
      // Subject-specific assignment
      const subjectInfo = assignment.subjects as any
      if (subjectInfo && !cls.subjects.find((s: any) => s.id === subjectInfo.id)) {
        cls.subjects.push({
          id: subjectInfo.id,
          name: subjectInfo.name,
        })
        cls.allSubjects.push(subjectInfo.id)
        console.log(`[v0] ${teacherId} assigned to ${subjectInfo.name} in ${classInfo?.name}`)
      }
    }
  })

  const classes = Array.from(classMap.values())

  console.log(`[v0] Teacher has access to ${classes.length} classes`)
  classes.forEach((c: any) => {
    console.log(`  - ${c.name}: ${c.isClassTeacher ? 'CLASS TEACHER' : c.subjects.length + ' subjects'}`)
  })

  return { success: true, classes }
}

/**
 * CRITICAL: Verify teacher can edit a specific subject in a class.
 * Returns true if the teacher is the class teacher OR explicitly assigned to that subject.
 */
export async function canTeacherEditSubject(
  teacherId: string,
  classId: string,
  subjectId: string
): Promise<{ allowed: boolean; reason: string }> {
  console.log(`[v0] Checking: Can teacher ${teacherId} edit subject ${subjectId} in class ${classId}?`)

  const supabase = await createClient()

  // Class teacher (subject_id NULL) can edit everything in the class
  const { data: classTeacherRow } = await supabase
    .from('teacher_assignments')
    .select('id')
    .eq('user_id', teacherId)
    .eq('class_id', classId)
    .is('subject_id', null)
    .maybeSingle()

  if (classTeacherRow) {
    console.log('[v0] Result: ALLOWED (class teacher)')
    return { allowed: true, reason: 'Teacher is the class teacher' }
  }

  // Otherwise, must be assigned to this specific subject
  const { data: assignment, error } = await supabase
    .from('teacher_assignments')
    .select('id')
    .eq('user_id', teacherId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .maybeSingle()

  if (error) {
    console.error('[v0] Error checking assignment:', error.message)
    return { allowed: false, reason: 'Database error' }
  }

  const allowed = !!assignment
  console.log(`[v0] Result: ${allowed ? 'ALLOWED' : 'DENIED'}`)

  return {
    allowed,
    reason: allowed ? 'Teacher assigned to this subject' : 'Teacher not assigned to this subject',
  }
}

/**
 * CRITICAL: Check if teacher is a class teacher (can edit all subjects)
 */
export async function isTeacherClassTeacher(teacherId: string, classId: string): Promise<boolean> {
  console.log(`[v0] Checking: Is teacher ${teacherId} a class teacher for ${classId}?`)

  const supabase = await createClient()

  const { data: assignment, error } = await supabase
    .from('teacher_assignments')
    .select('id')
    .eq('user_id', teacherId)
    .eq('class_id', classId)
    .is('subject_id', null)
    .maybeSingle()

  if (error) {
    console.error('[v0] Error checking class teacher status:', error.message)
    return false
  }

  const isClassTeacher = !!assignment
  console.log(`[v0] Result: ${isClassTeacher ? 'YES - Class Teacher' : 'NO - Subject Teacher'}`)

  return isClassTeacher
}
