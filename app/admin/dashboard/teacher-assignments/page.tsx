'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Plus, Users } from 'lucide-react'

interface Teacher {
  id: string
  first_name: string
  last_name: string
  email: string
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
  user_id: string
  class_id: string
  subject_id: string | null
  is_active: boolean
  teacher_name: string
  class_name: string
  subject_name: string | null
}

export default function TeacherAssignmentsPage() {
  const { currentSchool } = useSchool()
  const router = useRouter()
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
    if (currentSchool?.id) {
      fetchData()
    }
  }, [currentSchool?.id])

  async function fetchData() {
    if (!currentSchool?.id) return
    setLoading(true)

    try {
      // Fetch teachers from teacher_accounts
      const { data: teacherAccounts } = await supabase
        .from('teacher_accounts')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)

      if (teacherAccounts) {
        setTeachers(
          teacherAccounts.map((ta: any) => ({
            id: ta.id,
            first_name: ta.first_name,
            last_name: ta.last_name,
            email: ta.email,
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

      // Fetch assignments with related data
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select(`
          id,
          user_id,
          class_id,
          subject_id,
          is_active,
          classes!inner(name),
          subjects(name)
        `)
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)

      if (assignmentsData) {
        const enrichedAssignments = assignmentsData.map((a: any) => {
          const teacher = teachers.find(t => t.id === a.user_id)
          return {
            id: a.id,
            user_id: a.user_id,
            class_id: a.class_id,
            subject_id: a.subject_id,
            is_active: a.is_active,
            teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unknown Teacher',
            class_name: a.classes?.name || 'Unknown Class',
            subject_name: a.subjects?.name || null,
          }
        })
        setAssignments(enrichedAssignments)
      }
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
      // Check for duplicate
      const { data: existing } = await supabase
        .from('teacher_assignments')
        .select('id')
        .eq('school_id', currentSchool?.id)
        .eq('user_id', selectedTeacher)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject === 'all' ? null : selectedSubject)
        .eq('is_active', true)

      if (existing && existing.length > 0) {
        setMessage({ type: 'error', text: 'This assignment already exists' })
        return
      }

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
    if (!window.confirm('Are you sure you want to remove this assignment?')) return

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Teacher Assignments</h1>
        <p className="text-gray-600">
          Manage which teachers can edit marks for specific classes and subjects
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add Assignment Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">Add New Assignment</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teacher
            </label>
            <select
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a teacher...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Subjects (Class Teacher)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={addAssignment}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Assignment
            </button>
          </div>
        </div>
      </div>

      {/* Current Assignments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Current Assignments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.length > 0 ? (
                assignments.map(assignment => (
                  <tr
                    key={assignment.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.teacher_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.class_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.subject_name || (
                        <span className="text-blue-600 font-medium">All Subjects</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => removeAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800 font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-gray-500 text-sm"
                  >
                    No assignments yet. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • <strong>Class Teacher (All Subjects):</strong> Select "All Subjects" to let a
            teacher edit all subjects in a class (Lower Primary)
          </li>
          <li>
            • <strong>Subject Teacher:</strong> Select a specific subject to restrict editing
            to that subject (Upper Primary)
          </li>
          <li>• Teachers can VIEW all marks but can only EDIT their assigned classes/subjects</li>
          <li>• Use this to prevent unauthorized changes to marks</li>
        </ul>
      </div>
    </div>
  )
}
