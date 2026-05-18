'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { email, password, schoolId } = await req.json()

    if (!email || !password || !schoolId) {
      return Response.json(
        { error: 'Email, password, and school ID are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Find teacher account
    const { data: teacher, error: findError } = await supabase
      .from('teacher_accounts')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single()

    if (findError || !teacher) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, teacher.password)
    if (!passwordMatch) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Fetch teacher assignments
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('id, class_id, subject_id, is_active')
      .eq('user_id', teacher.id)
      .eq('school_id', schoolId)
      .eq('is_active', true)

    // Get class and subject details
    const classIds = [...new Set(assignments?.map(a => a.class_id) || [])]
    const subjectIds = [...new Set(assignments?.map(a => a.subject_id).filter(Boolean) || [])]

    let classDetails = []
    let subjectDetails = []

    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds)
      classDetails = classes || []
    }

    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)
      subjectDetails = subjects || []
    }

    // Create session data
    const sessionData = {
      teacherId: teacher.id,
      email: teacher.email,
      firstName: teacher.first_name,
      lastName: teacher.last_name,
      schoolId: schoolId,
      assignments: assignments || [],
      assignedClasses: classDetails,
      assignedSubjects: subjectDetails,
      loginTime: new Date().toISOString(),
    }

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set('teacher_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    return Response.json({
      success: true,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: `${teacher.first_name} ${teacher.last_name || ''}`.trim(),
      },
      assignments: assignments || [],
      assignedClasses: classDetails,
      assignedSubjects: subjectDetails,
    })
  } catch (error) {
    console.error('[v0] Teacher login error:', error)
    return Response.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}
