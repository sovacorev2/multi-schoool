'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Plus } from 'lucide-react'

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
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    teacher_id: '',
    class_id: '',
    subject_id: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (currentSchool?.id) {
      fetchData()
    }
  }, [currentSchool])

  async function fetchData() {
    if (!currentSchool?.id) return
    setIsLoading(true)
    
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
        .order('name')
      setSubjects(subjectsData || [])

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select(`
          id,
          user_id,
          class_id,
          subject_id,
          is_active,
          classes(name),
          subjects(name)
        `)
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (assignmentsData) {
        const enrichedAssignments = assignmentsData.map((a: any) => {
          const teacher = teacherAccounts?.find((t: any) => t.id === a.user_id)
          return {
            id: a.id,
            user_id: a.user_id,
            class_id: a.class_id,
            subject_id: a.subject_id,
            is_active: a.is_active,
            teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unknown',
            class_name: a.classes?.name || 'Unknown Class',
            subject_name: a.subjects?.name || null,
          }
        })
        setAssignments(enrichedAssignments)
      }
    } catch (err) {
      console.error('[v0] Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddAssignment(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      if (!formData.teacher_id || !formData.class_id) {
        throw new Error('Please select a teacher and class')
      }

      const { error: err } = await supabase
        .from('teacher_assignments')
        .insert([{
          school_id: currentSchool?.id,
          user_id: formData.teacher_id,
          class_id: formData.class_id,
          subject_id: formData.subject_id || null,
        }])

      if (err) {
        if (err.message.includes('unique')) {
          throw new Error('This teacher is already assigned to this class/subject')
        }
        throw err
      }

      const teacher = teachers.find(t => t.id === formData.teacher_id)
      const classItem = classes.find(c => c.id === formData.class_id)
      const subject = subjects.find(s => s.id === formData.subject_id)
      
      setSuccess(`✅ ${teacher?.first_name} assigned to ${classItem?.name}${subject ? ` - ${subject.name}` : ' (All Subjects)'}`)
      setFormData({ teacher_id: '', class_id: '', subject_id: '' })
      setShowAddForm(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add assignment')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!confirm('Remove this assignment?')) return

    try {
      const { error: err } = await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', id)

      if (err) throw err
      setSuccess('Assignment removed')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Assignments</h1>
          <p className="text-gray-600 mt-1">Assign teachers to classes and subjects</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Assignment
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>How assignments work:</strong> Assign teachers to classes. Leave Subject blank for "All Subjects" or select a specific subject. Teachers can only edit marks for their assigned classes and subjects.
          </p>
        </CardContent>
      </Card>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Teacher Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAssignment} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-2">Teacher *</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
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
                <label className="block text-sm font-medium mb-2">Class *</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
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
                <label className="block text-sm font-medium mb-2">Subject (Optional)</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Subjects (Class Teacher)</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Leave blank for class teacher teaching all subjects</p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Assignment'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Assignments ({assignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading assignments...</p>
          ) : assignments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No assignments yet. Add one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.teacher_name}</TableCell>
                      <TableCell>{assignment.class_name}</TableCell>
                      <TableCell>
                        {assignment.subject_name ? (
                          <Badge variant="outline">{assignment.subject_name}</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">All Subjects</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignment.subject_name ? (
                          <span className="text-sm text-gray-600">Subject Teacher</span>
                        ) : (
                          <span className="text-sm text-gray-600">Class Teacher</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
