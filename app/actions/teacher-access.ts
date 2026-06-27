'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * CRITICAL: Get teacher's allowed classes and subjects from database
 * This enforces subject restrictions - teachers can ONLY access assigned subjects
 */
export async function getTeacherAssignedClasses(teacherId: string) {
  console.log('[v0] Fetching assignments for teacher:', teacherId)
  
  const supabase = await createClient()
  
  // Get all assignments for this teacher
  const { data: assignments, error } = await supabase
    .from('teacher_assignments')
    .select(`
      id,
      teacher_id,
      class_id,
      subject_id,
      classes:class_id ( id, name, school_id ),
      subjects:subject_id ( id, code, name )
    `)
    .eq('teacher_id', teacherId)
  
  if (error) {
    console.error('[v0] Error fetching assignments:', error)
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
        allSubjects: []  // Track what subject IDs this teacher can edit
      })
    }
    
    const cls = classMap.get(classId)
    
    // If subject_id is null, this teacher is a class teacher
    if (!assignment.subject_id) {
      cls.isClassTeacher = true
      console.log(`[v0] ${teacherId} is CLASS TEACHER for ${classInfo?.name}`)
    } else {
      // Subject assignment
      const subjectInfo = assignment.subjects as any
      if (subjectInfo && !cls.subjects.find((s: any) => s.id === subjectInfo.id)) {
        cls.subjects.push({
          id: subjectInfo.id,
          code: subjectInfo.code,
          name: subjectInfo.name
        })
        cls.allSubjects.push(subjectInfo.id)  // Store ID for comparison
        console.log(`[v0] ${teacherId} assigned to ${subjectInfo.code} in ${classInfo?.name}`)
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
 * CRITICAL: Verify teacher can edit a specific subject in a class
 * Returns true ONLY if teacher is explicitly assigned to that subject
 */
export async function canTeacherEditSubject(
  teacherId: string,
  classId: string,
  subjectId: string
): Promise<{ allowed: boolean; reason: string }> {
  console.log(`[v0] Checking: Can teacher ${teacherId} edit subject ${subjectId} in class ${classId}?`)
  
  const supabase = await createClient()
  
  // Get this specific assignment
  const { data: assignment, error } = await supabase
    .from('teacher_assignments')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .single()
  
  if (error && error.code !== 'PGRST116') {  // PGRST116 = no rows returned
    console.error('[v0] Error checking assignment:', error)
    return { allowed: false, reason: 'Database error' }
  }
  
  const allowed = !!assignment
  console.log(`[v0] Result: ${allowed ? 'ALLOWED' : 'DENIED'}`)
  
  return {
    allowed,
    reason: allowed 
      ? 'Teacher assigned to this subject'
      : 'Teacher not assigned to this subject'
  }
}

/**
 * CRITICAL: Check if teacher is a class teacher (can edit all subjects)
 */
export async function isTeacherClassTeacher(
  teacherId: string,
  classId: string
): Promise<boolean> {
  console.log(`[v0] Checking: Is teacher ${teacherId} a class teacher for ${classId}?`)
  
  const supabase = await createClient()
  
  // Class teachers have a row with subject_id = NULL
  const { data: assignment, error } = await supabase
    .from('teacher_assignments')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .is('subject_id', null)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('[v0] Error checking class teacher status:', error)
    return false
  }
  
  const isClassTeacher = !!assignment
  console.log(`[v0] Result: ${isClassTeacher ? 'YES - Class Teacher' : 'NO - Subject Teacher'}`)
  
  return isClassTeacher
}

