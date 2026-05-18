'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'

interface Teacher {
  id: string
  name: string
}

interface Class {
  id: string
  name: string
}

interface Subject {
  id: string
  name: string
}

interface Assignment {
  id: string
  teacher_id: string
  class_id: string
  subject_id: string | null
}

export function TeacherAssignments() {
  const { currentSchool } = useSchool()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [currentSchool?.id])

  async function fetchData() {
    if (!currentSchool?.id) return
    setLoading(true)

    try {
      // Fetch all teachers for this school (from auth.users metadata)
      const { data: schoolUsers } = await supabase
        .from('school_users')
        .select('user_id, role')
        .eq('school_id', currentSchool.id)
        .eq('role', 'teacher')

      if (schoolUsers) {
        // You'd need to map these to actual user names from your users table
        setTeachers(
          schoolUsers.map((su, idx) => ({
            id: su.user_id,
            name: `Teacher ${idx + 1}`,
          }))
        )
      }

      // Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', currentSchool.id)
        .order('name')

      setClasses(classesData || [])

      // Fetch subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', currentSchool.id)
        .order('name')

      setSubjects(subjectsData || [])

      // Fetch current assignments
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select('id, user_id as teacher_id, class_id, subject_id')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)

      setAssignments(assignmentsData || [])
    } catch (error) {
      console.error('[v0] Error fetching data:', error)
      setMessage({ type: 'error', text: 'Failed to load data' })
    } finally {
      setLoading(false)
    }
  }

  async function addAssignment() {
    if (!selectedTeacher || !selectedClass) {
      setMessage({ type: 'error', text: 'Please select a teacher and class' })
      return
    }

    try {
      const { error } = await supabase.from('teacher_assignments').insert({
        school_id: currentSchool?.id,
        user_id: selectedTeacher,
        class_id: selectedClass,
        subject_id: selectedSubject === 'all' ? null : selectedSubject,
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Assignment added successfully' })
      setSelectedTeacher('')
      setSelectedClass('')
      setSelectedSubject('all')
      await fetchData()
    } catch (error) {
      console.error('[v0] Error adding assignment:', error)
      setMessage({ type: 'error', text: 'Failed to add assignment' })
    }
  }

  async function removeAssignment(assignmentId: string) {
    try {
      const { error } = await supabase
        .from('teacher_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Assignment removed' })
      await fetchData()
    } catch (error) {
      console.error('[v0] Error removing assignment:', error)
      setMessage({ type: 'error', text: 'Failed to remove assignment' })
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Teacher Assignments</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add Assignment Form */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h3 className="text-lg font-semibold mb-4">Add New Assignment</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Teacher</label>
            <select
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">Select a teacher...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Class</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">Select a class...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="all">All Subjects (Class Teacher)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={addAssignment}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Assignment
        </button>
      </div>

      {/* Current Assignments */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Current Assignments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Teacher</th>
                <th className="px-4 py-2 text-left">Class</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(assignment => {
                const teacher = teachers.find(t => t.id === assignment.teacher_id)
                const assignedClass = classes.find(c => c.id === assignment.class_id)
                const subject = subjects.find(s => s.id === assignment.subject_id)

                return (
                  <tr key={assignment.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{teacher?.name || 'Unknown'}</td>
                    <td className="px-4 py-2">{assignedClass?.name || 'Unknown'}</td>
                    <td className="px-4 py-2">
                      {subject?.name || 'All Subjects'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => removeAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                    No assignments yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
