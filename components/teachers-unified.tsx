'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendTeacherWelcomeEmail } from '@/lib/email-service'
import { sortClassesByLevel } from '@/lib/class-sort-utils'
import { isShuleTechSchool } from '@/lib/shuletech-features'
import type { Subject } from '@/lib/types'

interface Teacher {
  id: string
  email: string
  first_name: string
  last_name: string
  pin?: string
  phone_number?: string | null
}

interface ClassTeacherAssignment {
  teacherId: string
  classId: string
  teacherName: string
}

interface Assignment {
  id: string
  user_id: string
  class_id: string
  class_name?: string
  subject_id: string | null
  subject_name?: string
  is_active: boolean
}

interface TeachersUnifiedProps {
  schoolId: string
  schoolName: string
}

export function TeachersUnified({ schoolId, schoolName }: TeachersUnifiedProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classSubjects, setClassSubjects] = useState<Subject[]>([])
  const [selectedClass, setSelectedClass] = useState('')

  // Create new teacher form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeacher, setNewTeacher] = useState({ first_name: '', last_name: '', email: '', phone_number: '' })

  // Edit teacher details modal
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [editFormData, setEditFormData] = useState({ first_name: '', last_name: '', email: '', phone_number: '' })

  // Edit assignment modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [newAssignment, setNewAssignment] = useState({ class_id: '', subject_id: '' })

  // Loading/Messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [schoolId])

  const loadData = async () => {
    const supabase = createClient()

    // Load teachers
    const { data: teachersRes } = await supabase
      .from('teacher_accounts')
      .select('*')
      .eq('school_id', schoolId)
      .order('first_name')

    // Load assignments
    const { data: assignmentsRes } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('school_id', schoolId)

    // Load classes
    const { data: classesRes } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .order('display_order')

    // Load all subjects from all classes in this school
    // Get all class IDs first
    const classIds = classesRes?.map(c => c.id) || []
    
    let subjectsRes = []
    if (classIds.length > 0) {
      const { data } = await supabase
        .from('subjects')
        .select('*')
        .in('class_id', classIds)
        .order('name')
      subjectsRes = data || []
    }

    console.log('[v0] Subjects loaded:', { subjectsRes, classIds, schoolId })

    setTeachers(teachersRes || [])
    setAssignments(assignmentsRes || [])
    setClasses(sortClassesByLevel(classesRes || []))
    setSubjects(subjectsRes)
  }

  // Load subjects when class is selected
  const handleClassSelect = async (classId: string) => {
    setSelectedClass(classId)
    setNewAssignment({ class_id: classId, subject_id: '' })

    const supabase = createClient()
    const { data: subjectsRes } = await supabase
      .from('subjects')
      .select('*')
      .eq('class_id', classId)
      .order('name')

    setClassSubjects(subjectsRes || [])
  }

  // Get classes where teacher is class teacher (no specific subject assigned)
  const getTeacherClassTeacherFor = (teacherId: string) => {
    return assignments
      .filter(a => a.user_id === teacherId && !a.subject_id && a.is_active)
      .map(a => classes.find(c => c.id === a.class_id)?.name)
      .filter(Boolean)
  }

  // Create new teacher
  const createTeacher = async () => {
    if (!newTeacher.first_name.trim() || !newTeacher.last_name.trim() || !newTeacher.email.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const pin = Math.floor(1000 + Math.random() * 9000).toString()

      const { error } = await supabase.from('teacher_accounts').insert({
        school_id: schoolId,
        email: newTeacher.email.trim(),
        first_name: newTeacher.first_name.trim(),
        last_name: newTeacher.last_name.trim(),
        phone_number: newTeacher.phone_number.trim() || null,
        pin: pin,
        is_active: true,
      })

      if (error) throw error

      setMessage({ type: 'success', text: `Teacher ${newTeacher.first_name} ${newTeacher.last_name} created with PIN: ${pin}` })
      setNewTeacher({ first_name: '', last_name: '', email: '', phone_number: '' })
      setShowCreateForm(false)
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Add assignment to teacher
  const addAssignment = async () => {
    if (!selectedTeacher || !newAssignment.class_id) {
      setMessage({ type: 'error', text: 'Please select a class' })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      const { error } = await supabase.from('teacher_assignments').insert({
        school_id: schoolId,
        user_id: selectedTeacher.id,
        class_id: newAssignment.class_id,
        subject_id: newAssignment.subject_id || null,
        is_active: true,
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Assignment added successfully' })
      setShowEditModal(false)
      setNewAssignment({ class_id: '', subject_id: '' })
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Delete assignment
  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('teacher_assignments').delete().eq('id', assignmentId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Assignment deleted' })
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Update teacher details
  const updateTeacher = async () => {
    if (!editingTeacher) return
    if (!editFormData.first_name || !editFormData.last_name || !editFormData.email) {
      setMessage({ type: 'error', text: 'All fields are required' })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teacher_accounts')
        .update({
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          email: editFormData.email,
          phone_number: editFormData.phone_number || null,
        })
        .eq('id', editingTeacher.id)
        .eq('school_id', schoolId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Teacher updated successfully' })
      setShowEditTeacherModal(false)
      setEditingTeacher(null)
      setEditFormData({ first_name: '', last_name: '', email: '', phone_number: '' })
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Delete teacher
  const deleteTeacher = async (teacherId: string) => {
    if (!confirm('Are you sure you want to delete this teacher? This will also delete all their assignments.')) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Delete all assignments first
      await supabase
        .from('teacher_assignments')
        .delete()
        .eq('user_id', teacherId)
        .eq('school_id', schoolId)

      // Delete teacher
      const { error } = await supabase
        .from('teacher_accounts')
        .delete()
        .eq('id', teacherId)
        .eq('school_id', schoolId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Teacher deleted successfully' })
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Send email to teacher (ShuleTech only)
  const notifyTeacher = async (teacher: Teacher) => {
    // Only send emails for ShuleTech school
    if (!isShuleTechSchool(schoolName)) {
      setMessage({ type: 'error', text: 'Email notifications are only available for ShuleTech at this time' })
      return
    }

    setLoading(true)
    try {
      const teacherAssignments = assignments.filter(a => a.user_id === teacher.id && a.is_active)

      if (teacherAssignments.length === 0) {
        setMessage({ type: 'error', text: 'Teacher has no active assignments to notify about' })
        setLoading(false)
        return
      }

      // Enrich assignments with class and subject names
      const enrichedAssignments = teacherAssignments.map(a => {
        const classData = classes.find(c => c.id === a.class_id)
        const subjectData = subjects.find(s => s.id === a.subject_id)

        return {
          className: classData?.name || 'Unknown Class',
          subjectName: a.subject_id ? (subjectData?.name || 'Unknown Subject') : 'All Subjects',
        }
      })

      console.log('[v0] Teacher:', teacher)
      console.log('[v0] Teacher assignments found:', teacherAssignments.length)
      console.log('[v0] Enriched assignments:', enrichedAssignments)
      console.log('[v0] Email data to send:', {
        email: teacher.email,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        pin: teacher.pin,
        schoolName,
        assignments: enrichedAssignments,
      })

      const result = await sendTeacherWelcomeEmail({
        email: teacher.email,
        firstName: teacher.first_name || '',
        lastName: teacher.last_name || '',
        pin: teacher.pin || '',
        schoolName,
        assignments: enrichedAssignments,
      })

      console.log('[v0] Email result:', result)

      if (result.success) {
        setMessage({ type: 'success', text: `Email sent to ${teacher.email}` })
      } else {
        setMessage({ type: 'error', text: `Failed to send email: ${result.error}` })
      }
    } catch (err: any) {
      console.error('[v0] Email error:', err)
      setMessage({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  // Send WhatsApp to teacher (ShuleTech only)
  const notifyTeacherWhatsApp = async (teacher: Teacher) => {
    // Only send WhatsApp for ShuleTech school
    if (!isShuleTechSchool(schoolName)) {
      setMessage({ type: 'error', text: 'WhatsApp notifications are only available for ShuleTech at this time' })
      return
    }

    // Check if phone number exists
    if (!teacher.phone_number) {
      setMessage({ type: 'error', text: 'Teacher phone number not set. Please add phone number in Edit Details.' })
      return
    }

    setLoading(true)
    try {
      const teacherAssignments = assignments.filter(a => a.user_id === teacher.id && a.is_active)

      if (teacherAssignments.length === 0) {
        setMessage({ type: 'error', text: 'Teacher has no active assignments to notify about' })
        setLoading(false)
        return
      }

      // Enrich assignments with class and subject names
      const enrichedAssignments = teacherAssignments.map(a => {
        const classData = classes.find(c => c.id === a.class_id)
        const subjectData = subjects.find(s => s.id === a.subject_id)

        return {
          className: classData?.name || 'Unknown Class',
          subjectName: a.subject_id ? (subjectData?.name || 'Unknown Subject') : 'All Subjects',
        }
      })

      // Create WhatsApp message
      const assignmentsList = enrichedAssignments
        .map(a => `• ${a.className} - ${a.subjectName}`)
        .join('\n')

      const message = `Hello ${teacher.first_name},\n\nYou have been assigned to the following classes at ${schoolName}:\n\n${assignmentsList}\n\nYour PIN: ${teacher.pin}\n\nPlease log in to the system to manage your subjects and marks.`

      // Encode message for WhatsApp
      const encodedMessage = encodeURIComponent(message)
      const phoneNumber = teacher.phone_number.replace(/\D/g, '') // Remove non-digits

      // Open WhatsApp Web or WhatsApp app
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`
      window.open(whatsappUrl, '_blank')

      setMessage({ type: 'success', text: `WhatsApp message opened for ${teacher.first_name}. Please send the message.` })
    } catch (err: any) {
      console.error('[v0] WhatsApp error:', err)
      setMessage({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Create Teacher Form */}
      {showCreateForm ? (
        <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold">Create New Teacher</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="First Name"
              value={newTeacher.first_name}
              onChange={(e) => setNewTeacher({ ...newTeacher, first_name: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={newTeacher.last_name}
              onChange={(e) => setNewTeacher({ ...newTeacher, last_name: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={newTeacher.email}
              onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <input
              type="tel"
              placeholder="Phone Number (e.g., +254123456789)"
              value={newTeacher.phone_number}
              onChange={(e) => setNewTeacher({ ...newTeacher, phone_number: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Optional: Include country code for WhatsApp notifications (ShuleTech only)</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createTeacher}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Teacher'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
        >
          + Create New Teacher
        </button>
      )}

      {/* Teachers List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Teachers & Assignments ({teachers.length})</h3>

        {teachers.length === 0 ? (
          <p className="text-gray-600">No teachers yet. Create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {teachers.map((teacher) => {
              const teacherAssignments = assignments.filter((a) => a.user_id === teacher.id && a.is_active)

              return (
                <div key={teacher.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-base">
                          {teacher.first_name} {teacher.last_name}
                        </h4>
                        {/* Class Teacher Badges - ShuleTech only */}
                        {isShuleTechSchool(schoolName) && getTeacherClassTeacherFor(teacher.id).map((className) => (
                          <span key={className} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                            Class Teacher: {className}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600">{teacher.email}</p>
                      {teacher.phone_number && (
                        <p className="text-sm text-gray-600">📱 {teacher.phone_number}</p>
                      )}
                      {/* PIN display - ShuleTech only */}
                      {isShuleTechSchool(schoolName) && (
                        <div className="mt-2 bg-blue-50 border border-blue-200 rounded px-3 py-2 inline-block">
                          <p className="text-xs font-semibold text-blue-900">PIN: <span className="font-mono text-sm tracking-widest">{teacher.pin}</span></p>
                        </div>
                      )}

                      {/* Assignments list */}
                      {teacherAssignments.length > 0 && (
                        <div className="mt-3 bg-gray-50 p-3 rounded text-sm">
                          <p className="font-medium text-gray-700 mb-2">Assignments ({teacherAssignments.length}):</p>
                          <ul className="space-y-1 text-gray-600">
                            {teacherAssignments.map((a) => {
                              const classData = classes.find((c) => c.id === a.class_id)
                              // Find subject name from allSubjects (need to load all subjects)
                              const subjectData = subjects.find((s) => s.id === a.subject_id)
                              return (
                                <li key={a.id}>
                                  {classData?.name || 'Unknown Class'}
                                  {a.subject_id && ` - ${subjectData?.name || 'Unknown Subject'}`}
                                  {!a.subject_id && ' - All Subjects'}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 min-w-fit">
                      <button
                        onClick={() => {
                          setSelectedTeacher(teacher)
                          setShowEditModal(true)
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                      >
                        Edit Assignments
                      </button>
                      <button
                        onClick={() => notifyTeacher(teacher)}
                        disabled={loading || teacherAssignments.length === 0}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:opacity-50"
                      >
                        Email
                      </button>
                      {isShuleTechSchool(schoolName) && (
                        <button
                          onClick={() => notifyTeacherWhatsApp(teacher)}
                          disabled={loading || teacherAssignments.length === 0 || !teacher.phone_number}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                          title={!teacher.phone_number ? 'Phone number not set' : 'Send WhatsApp notification'}
                        >
                          WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingTeacher(teacher)
                          setEditFormData({
                            first_name: teacher.first_name,
                            last_name: teacher.last_name,
                            email: teacher.email,
                            phone_number: teacher.phone_number || '',
                          })
                          setShowEditTeacherModal(true)
                        }}
                        className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                      >
                        Edit Details
                      </button>
                      <button
                        onClick={() => deleteTeacher(teacher.id)}
                        disabled={loading}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Assignments Modal */}
      {showEditModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold">Add Assignment for {selectedTeacher.first_name}</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={newAssignment.class_id}
                  onChange={(e) => handleClassSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">-- Select a class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClass && (
                <div>
                  <label className="block text-sm font-medium mb-1">Subject (Optional)</label>
                  <select
                    value={newAssignment.subject_id}
                    onChange={(e) => setNewAssignment({ ...newAssignment, subject_id: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">-- All Subjects (Class Teacher) --</option>
                    {classSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={addAssignment}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Assignment'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>

            {/* Show existing assignments for this teacher */}
            {assignments.filter((a) => a.user_id === selectedTeacher.id).length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Existing Assignments:</p>
                <div className="space-y-1">
                  {assignments
                    .filter((a) => a.user_id === selectedTeacher.id)
                    .map((a) => {
                      const classData = classes.find((c) => c.id === a.class_id)
                      return (
                        <div key={a.id} className="flex items-center justify-between bg-gray-100 p-2 rounded text-sm">
                          <span>
                            {classData?.name || 'Unknown'} {a.subject_id && `- Subject`}
                          </span>
                          <button
                            onClick={() => deleteAssignment(a.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Teacher Details Modal */}
      {showEditTeacherModal && editingTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold">Edit Teacher Details</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={editFormData.first_name}
                  onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="First name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={editFormData.last_name}
                  onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone Number (WhatsApp)</label>
                <input
                  type="tel"
                  value={editFormData.phone_number}
                  onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., +254123456789"
                />
                <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +254 for Kenya)</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  setShowEditTeacherModal(false)
                  setEditingTeacher(null)
      setEditFormData({ first_name: '', last_name: '', email: '', phone_number: '' })
                }}
                className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={updateTeacher}
                disabled={loading}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
