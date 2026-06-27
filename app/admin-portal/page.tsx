'use client'

// Prevent static generation for this dynamic page
export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { useClass } from '@/lib/class-context'
import { sortClassesByLevel } from '@/lib/class-sort-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Shield, Eye, EyeOff, Settings, BookOpen, Calendar, 
  Clock, FileText, Plus, Trash2, Save, ArrowLeft, Lock, Unlock,
  GraduationCap, ClipboardList, History, Edit, Users, X, Key, Copy, Check
} from 'lucide-react'
import type { Class, ExamType, Subject } from '@/lib/types'
import SchoolLogoUploader from '@/components/admin/SchoolLogoUploader'
import { TeachersUnified } from '@/components/teachers-unified'
import { AdminPWARegistration } from '@/components/admin-pwa-registration'

const TERMS = ['Term 1', 'Term 2', 'Term 3']

// Helper to sort classes: PLAYGROUP, PP1, PP2, then Grade 1, 2, 3... with streams alphabetically
function sortClasses(classes: Class[]): Class[] {
  return sortClassesByLevel(classes)
}

// Helper to extract base class name (e.g., "Grade 7" from "Grade 7 EAST")
function getBaseClassName(className: string): string {
  const match = className.match(/^(PLAYGROUP|PP\d+|Grade\s*\d+|Form\s*\d+)(?:\s+(.+))?$/i)
  return match ? match[1] : className
}

// Get all UNIQUE base class names and their stream counts
interface BaseClassInfo {
  name: string
  streamCount: number
}

function getUniqueBaseClasses(classes: Class[]): BaseClassInfo[] {
  const baseClassMap = new Map<string, Set<string>>()
  
  // For each class, extract base name and all stream variants
  classes.forEach(cls => {
    const baseName = getBaseClassName(cls.name).trim()
    if (!baseClassMap.has(baseName)) {
      baseClassMap.set(baseName, new Set())
    }
    baseClassMap.get(baseName)!.add(cls.id)
  })
  
  // Convert to sorted array
  const baseClasses: BaseClassInfo[] = Array.from(baseClassMap.entries()).map(([name, ids]) => ({
    name,
    streamCount: ids.size
  }))
  
  // Sort by grade level
  return baseClasses.sort((a, b) => {
    const aMatch = a.name.match(/\d+/)
    const bMatch = b.name.match(/\d+/)
    const aNum = aMatch ? parseInt(aMatch[0]) : 999
    const bNum = bMatch ? parseInt(bMatch[0]) : 999
    return aNum - bNum
  })
}

// Get all streams for a specific base class
function getStreamsForBaseClass(classes: Class[], baseName: string): Class[] {
  return classes
    .filter(cls => getBaseClassName(cls.name) === baseName)
    .sort((a, b) => a.name.localeCompare(b.name))
}

interface School {
  id: string
  name: string
  short_name: string
  code: string
  tagline: string
  email: string
  phone: string
  address: string
  primary_color: string
  admin_password: string
  is_active: boolean
}

interface AuditLog {
  id: string
  action: string
  details: string
  user_type: string
  created_at: string
}

interface Deadline {
  id: string
  class_id: string
  term: string
  year: number
  deadline_date: string
  is_locked: boolean
  class_name?: string
  exam_type?: string
}

export default function AdminPortalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentSchool, setCurrentSchool } = useSchool()
  const { setCurrentClass } = useClass()

  // Auth state
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Data state
  const [school, setSchool] = useState<School | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classSubjects, setClassSubjects] = useState<Subject[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [newExamType, setNewExamType] = useState('')
  const [newExamTypeYear, setNewExamTypeYear] = useState(new Date().getFullYear().toString())
  const [newExamTypeTerm, setNewExamTypeTerm] = useState('Term 1')
  const [newClassName, setNewClassName] = useState('')
  const [deletingExamTypeId, setDeletingExamTypeId] = useState<string | null>(null)
  
  // Stream management
  const [streamBaseClass, setStreamBaseClass] = useState('')
  const [newStreamName, setNewStreamName] = useState('')
  const [streamError, setStreamError] = useState('')
  const [existingStreams, setExistingStreams] = useState<Class[]>([])

  // Deadline form
  const [deadlineClass, setDeadlineClass] = useState('')
  const [deadlineExamType, setDeadlineExamType] = useState('')
  const [deadlineTerm, setDeadlineTerm] = useState('Term 1')
  const [deadlineYear, setDeadlineYear] = useState(new Date().getFullYear())
  const [deadlineDate, setDeadlineDate] = useState('')
  
  // Inline deadline editing
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null)
  const [editingDeadlineValue, setEditingDeadlineValue] = useState('')

  // Deadline filters
  const [deadlineFilters, setDeadlineFilters] = useState({
    className: '',
    examType: '',
    status: '', // 'all', 'open', 'deadline-set', 'locked'
  })

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Admin access to classes
  const [showAccessClassesMenu, setShowAccessClassesMenu] = useState(false)
  const [selectedClassForAccess, setSelectedClassForAccess] = useState<string | null>(null)

  // Edit class name
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [editingClassName, setEditingClassName] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Password management
  const [classPasswords, setClassPasswords] = useState<{[key: string]: string}>({})
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('')
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('')

  // Class teacher management
  const [classTeachers, setClassTeachers] = useState<{[key: string]: string}>({})
  const [teacherUpdateSuccess, setTeacherUpdateSuccess] = useState('')

  // PIN Login State
  const [teacherAccounts, setTeacherAccounts] = useState<any[]>([])
  const [showPINForm, setShowPINForm] = useState(false)
  const [pinFormData, setPinFormData] = useState({ firstName: '', lastName: '', email: '' })
  const [copiedPIN, setCopiedPIN] = useState<string | null>(null)
  const [pinLoginEnabled, setPinLoginEnabled] = useState(false)
  const [pinFormMessage, setPinFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Teacher Assignments State
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([])
  const [assignFormData, setAssignFormData] = useState({ teacherId: '', classId: '', subjectId: '' })
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignMessage, setAssignMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load school from URL or context - redirect if no school
  useEffect(() => {
    const schoolCode = searchParams.get('school')
    
    if (schoolCode) {
      // If URL has school code, check if it matches current school
      if (currentSchool && currentSchool.code === schoolCode) {
        return
      }
      // Load school from URL (different school or no school set)
      loadSchoolFromCode(schoolCode)
    } else if (!currentSchool) {
      // No school selected - stay on page (will prompt for school)
    }
  }, [searchParams, currentSchool, router])

  const loadSchoolFromCode = async (code: string) => {
    // Clear all data when switching schools
    setClasses([])
    setExamTypes([])
    setSubjects([])
    setSchool(null)
    setIsAuthenticated(false)
    setPassword('')
    
    const supabase = createClient()
    const { data } = await supabase
      .from('schools')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()
    
    if (data) {
      setCurrentSchool(data)
    }
    // If school not found, stay on page
  }

  // Handle password authentication
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setIsAuthenticating(true)

    try {
      const supabase = createClient()
      const { data: schoolData } = await supabase
        .from('schools')
        .select('*')
        .eq('id', currentSchool?.id)
        .single()

      if (schoolData && schoolData.admin_password === password) {
        setSchool(schoolData)
        setIsAuthenticated(true)
        loadAdminData()
      } else {
        setPasswordError('Incorrect admin password')
      }
    } catch {
      setPasswordError('An error occurred. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  // Load all admin data
  const loadAdminData = async () => {
    if (!currentSchool) return
    setIsLoading(true)

    try {
      const supabase = createClient()

      const [classesRes, examTypesRes, subjectsRes, schoolRes, teachersRes, assignmentsRes] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order'),
        supabase.from('exam_types').select('*').eq('school_id', currentSchool.id).order('name'),
        // Subjects don't have school_id - they belong to classes. Query without school filter.
        supabase.from('subjects').select('*').order('name'),
        supabase.from('schools').select('*').eq('id', currentSchool.id).single(),
        supabase.from('teacher_accounts').select('*').eq('school_id', currentSchool.id),
        supabase.from('teacher_assignments').select('*').eq('school_id', currentSchool.id),
      ])

      if (classesRes.data) setClasses(sortClassesByLevel(classesRes.data))
      if (examTypesRes.data) setExamTypes(examTypesRes.data)
      if (subjectsRes.data) setSubjects(subjectsRes.data)
      
      // Load PIN login settings
      if (schoolRes.data) {
        setPinLoginEnabled(schoolRes.data.feature_pin_management === true)
      }
      
      // Load teacher accounts
      if (teachersRes.data) {
        setTeacherAccounts(teachersRes.data)
      }

      // Load teacher assignments
      if (assignmentsRes.data) {
        setTeacherAssignments(assignmentsRes.data)
      }

      // Load deadlines from sessions - only show sessions with exam_type_id (actual exam sessions)
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*, classes(name), exam_types(name)')
        .eq('school_id', currentSchool.id)
        .not('exam_type_id', 'is', null)
        .order('created_at', { ascending: false })

      if (sessionsData) {
        setDeadlines(sessionsData.map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          term: s.term,
          year: s.year,
          deadline_date: s.deadline_datetime || '',
          is_locked: s.is_locked,
          class_name: s.classes?.name,
          exam_type: s.exam_types?.name
        })))
      }

      // Load audit logs - simple and straightforward
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (logsData) {
        setAuditLogs(logsData.map((log: any) => ({
          id: log.id,
          action: log.action,
          details: log.details,
          performed_by: log.performed_by,
          teacher_pin: log.teacher_pin,
          class_id: log.class_id,
          created_at: log.created_at
        })))
      }

    } catch (err) {
      console.error('[v0] Error loading admin data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Add exam type
  const addExamType = async () => {
    if (!newExamType.trim() || !currentSchool) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('exam_types')
      .insert({
        name: newExamType.trim(),
        school_id: currentSchool.id,
        year: parseInt(newExamTypeYear),
        term: newExamTypeTerm
      })
      .select()
      .single()

    if (!error && data) {
      setExamTypes([...examTypes, data])
      setNewExamType('')
      setNewExamTypeYear(new Date().getFullYear().toString())
      setNewExamTypeTerm('Term 1')
    }
  }

  // Delete exam type
  const deleteExamType = async (id: string) => {
    try {
      const examTypeName = examTypes.find(e => e.id === id)?.name || 'Unknown'
      const supabase = createClient()
      
      // Show confirmation immediately
      const confirmMessage = `Are you sure you want to delete "${examTypeName}"?\n\nThis will also delete all associated exam sessions and marks.\n\nThis action cannot be undone.`
      
      if (!confirm(confirmMessage)) {
        console.log('[v0] Delete exam type cancelled by user')
        return
      }

      setDeletingExamTypeId(id)
      console.log('[v0] Starting deletion of exam type:', id)

      // Delete everything referencing this exam type
      // Proceed with deletion even if dependencies don't exist
      
      try {
        console.log('[v0] Deleting marks...')
        await supabase
          .from('marks')
          .delete()
          .eq('exam_type_id', id)
        console.log('[v0] Marks deleted')
      } catch (e) {
        console.log('[v0] Marks deletion error (continuing):', e)
      }

      try {
        console.log('[v0] Deleting analytics sessions...')
        await supabase
          .from('analytics_sessions')
          .delete()
          .eq('exam_type_id', id)
        console.log('[v0] Analytics sessions deleted')
      } catch (e) {
        console.log('[v0] Analytics deletion error (continuing):', e)
      }

      try {
        console.log('[v0] Deleting sessions...')
        await supabase
          .from('sessions')
          .delete()
          .eq('exam_type_id', id)
        console.log('[v0] Sessions deleted')
      } catch (e) {
        console.log('[v0] Sessions deletion error (continuing):', e)
      }

      // Now delete the exam type itself
      console.log('[v0] Deleting exam type...')
      const { error: examTypeError } = await supabase.from('exam_types').delete().eq('id', id)

      if (examTypeError) {
        console.error('[v0] Error deleting exam type:', examTypeError)
        alert(`Failed to delete exam type: ${examTypeError.message}`)
        setDeletingExamTypeId(null)
        return
      }

      console.log('[v0] Exam type deleted successfully')
      setExamTypes(examTypes.filter(e => e.id !== id))
      setDeletingExamTypeId(null)
      alert(`Exam type "${examTypeName}" has been deleted successfully.`)
    } catch (error) {
      console.error('[v0] Delete exam type error:', error)
      alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`)
      setDeletingExamTypeId(null)
    }
  }

  // Add class
  const addClass = async () => {
    if (!newClassName.trim() || !currentSchool) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('classes')
      .insert({ 
        name: newClassName.trim(), 
        school_id: currentSchool.id,
        password: 'welcome',
        display_order: classes.length + 1
      })
      .select()
      .single()

    if (!error && data) {
      // Also create base sessions for the new class
      const currentYear = new Date().getFullYear()
      const terms = ['Term 1', 'Term 2', 'Term 3']
      const sessionsToInsert = terms.map(term => ({
        class_id: data.id,
        year: currentYear,
        term: term,
        is_active: true,
        school_id: currentSchool.id,
      }))
      await supabase.from('sessions').insert(sessionsToInsert)
      
      setClasses([...classes, data])
      setNewClassName('')
    }
  }

  // Update school settings
  const updateSchoolSettings = async () => {
    if (!school) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from('schools')
      .update({
        name: school.name,
        short_name: school.short_name,
        tagline: school.tagline,
        email: school.email,
        phone: school.phone,
        address: school.address,
        primary_color: school.primary_color
      })
      .eq('id', school.id)
    
    if (!error) {
      // Update school context so changes reflect in report headers immediately
      setCurrentSchool(school)
      alert('School settings updated successfully!')
      
      // Log the action
      await supabase.from('activity_logs').insert({
        school_id: school.id,
        action: 'school_settings_updated',
        details: `Updated school information: name, contact, address, color`,
        performed_by: 'Admin Portal'
      })
    } else {
      alert('Failed to update school settings: ' + error.message)
    }
  }

  // Delete class
  const handleDeleteClass = (classId: string, className: string) => {
    setClassToDelete({ id: classId, name: className })
    setDeleteConfirmOpen(true)
    setDeleteError('')
  }

  // Access class as admin (without password)
  const handleAccessClassAsAdmin = async (classId: string, className: string) => {
    try {
      // Fetch full class object from database
      const supabase = createClient()
      const { data: cls } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()
      
      if (cls) {
        // Use setCurrentClass to update context AND localStorage
        setCurrentClass(cls)
      }
    } catch (error) {
      console.log('[v0] Error fetching class:', error)
    }
    
    // Set admin bypass flag in localStorage so it persists
    localStorage.setItem("success_academy_admin_bypass", "true")
    
    // Redirect to dashboard with admin bypass flag and classId
    router.push(`/dashboard?adminBypass=true&classId=${classId}`)
  }

  const confirmDeleteClass = async () => {
    if (!classToDelete) return
    
    setIsDeleting(true)
    setDeleteError('')
    const supabase = createClient()
    const { error } = await supabase.from('classes').delete().eq('id', classToDelete.id)
    
    if (error) {
      setDeleteError(`Failed to delete class: ${error.message}`)
      setIsDeleting(false)
    } else {
      setClasses(classes.filter(c => c.id !== classToDelete.id))
      setDeleteConfirmOpen(false)
      setClassToDelete(null)
      setIsDeleting(false)
    }
  }

  const startEditClass = (classId: string, className: string) => {
    setEditingClassId(classId)
    setEditingClassName(className)
    setEditError('')
  }

  const cancelEditClass = () => {
    setEditingClassId(null)
    setEditingClassName('')
    setEditError('')
  }

  const saveEditClass = async (classId: string) => {
    if (!editingClassName.trim()) {
      setEditError('Class name cannot be empty')
      return
    }

    setIsSavingEdit(true)
    setEditError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('classes')
      .update({ name: editingClassName })
      .eq('id', classId)
    
    if (error) {
      setEditError(`Failed to update class: ${error.message}`)
      setIsSavingEdit(false)
    } else {
      setClasses(classes.map(c => 
        c.id === classId ? { ...c, name: editingClassName } : c
      ))
      setEditingClassId(null)
      setEditingClassName('')
      setIsSavingEdit(false)
    }
  }

  // Add new stream to base class
  const addStreamClass = async () => {
    if (!streamBaseClass || !newStreamName.trim() || !currentSchool) {
      setStreamError('Please select a grade level and enter a stream name')
      return
    }
    
    const streamClassName = `${streamBaseClass} ${newStreamName.trim().toUpperCase()}`
    
    // Check if this exact stream already exists
    if (classes.some(c => c.name.toUpperCase() === streamClassName.toUpperCase())) {
      setStreamError(`Stream "${streamClassName}" already exists`)
      return
    }
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('classes')
        .insert({ 
          name: streamClassName, 
          school_id: currentSchool.id,
          password: 'welcome',
          display_order: classes.length + 1
        })
        .select()
        .single()

      if (error) throw error
      
      if (data) {
        // Create sessions for the new stream
        const currentYear = new Date().getFullYear()
        const sessionsToInsert = TERMS.map(term => ({
          class_id: data.id,
          year: currentYear,
          term: term,
          is_active: true,
          school_id: currentSchool.id,
        }))
        await supabase.from('sessions').insert(sessionsToInsert)
        
        // Update local state
        const updatedClasses = [...classes, data]
        setClasses(updatedClasses)
        
        // Refresh existing streams
        const newStreams = getStreamsForBaseClass(updatedClasses, streamBaseClass)
        setExistingStreams(newStreams)
        
        setNewStreamName('')
        setStreamError('')
      }
    } catch (err: any) {
      setStreamError(err.message || 'Failed to create stream')
    }
  }

  // Add subject
  // Create exam session (deadline is set separately via inline edit)
  const createExamSession = async () => {
    if (!deadlineClass || !deadlineExamType || !currentSchool) return

    const supabase = createClient()
    
    // Check if session already exists
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_id', deadlineClass)
      .eq('exam_type_id', deadlineExamType)
      .eq('term', deadlineTerm)
      .eq('year', deadlineYear)
      .single()

    if (existingSession) {
      alert('This exam session already exists!')
      return
    }
    
    // Create new exam session (no deadline yet - set via inline edit)
    await supabase
      .from('sessions')
      .insert({
        class_id: deadlineClass,
        exam_type_id: deadlineExamType,
        term: deadlineTerm,
        year: deadlineYear,
        is_locked: false,
        school_id: currentSchool.id
      })

    loadAdminData()
    setDeadlineClass('')
    setDeadlineExamType('')
  }

  // Toggle session lock
  const toggleSessionLock = async (sessionId: string, currentLocked: boolean) => {
    const supabase = createClient()
    await supabase
      .from('sessions')
      .update({ is_locked: !currentLocked })
      .eq('id', sessionId)
    
    loadAdminData()
  }

  // Save deadline for a specific session
  const saveSessionDeadline = async (sessionId: string) => {
    if (!editingDeadlineValue) {
      setEditingDeadlineId(null)
      return
    }
    
    const supabase = createClient()
    await supabase
      .from('sessions')
      .update({ deadline_datetime: editingDeadlineValue ? new Date(editingDeadlineValue).toISOString() : null })
      .eq('id', sessionId)
    
    setEditingDeadlineId(null)
    setEditingDeadlineValue('')
    loadAdminData()
  }

  // Update school settings

  // Update class password
  const updateClassPassword = async (classId: string) => {
    const newPassword = classPasswords[classId]
    if (!newPassword || !newPassword.trim()) return

    const supabase = createClient()
    const { error } = await supabase
      .from('classes')
      .update({ password: newPassword.trim() })
      .eq('id', classId)

    if (!error) {
      setPasswordUpdateSuccess(`Password updated for class successfully!`)
      setClassPasswords(prev => ({ ...prev, [classId]: '' }))
      setTimeout(() => setPasswordUpdateSuccess(''), 3000)
    }
  }

  // Update class teacher name
  const updateClassTeacher = async (classId: string) => {
    const teacherName = classTeachers[classId]
    
    const supabase = createClient()
    const { error } = await supabase
      .from('classes')
      .update({ teacher_name: teacherName?.trim() || null })
      .eq('id', classId)

    if (!error) {
      setTeacherUpdateSuccess(`Class teacher updated successfully!`)
      // Update local classes state
      setClasses(prev => prev.map(c => 
        c.id === classId ? { ...c, teacher_name: teacherName?.trim() || null } : c
      ))
      setTimeout(() => setTeacherUpdateSuccess(''), 3000)
    }
  }

  // Update admin password
  const updateAdminPassword = async () => {
    if (!newAdminPassword || !currentSchool) return
    if (newAdminPassword !== confirmAdminPassword) {
      alert('Passwords do not match!')
      return
    }
    if (newAdminPassword.length < 4) {
      alert('Password must be at least 4 characters!')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('schools')
      .update({ admin_password: newAdminPassword })
      .eq('id', currentSchool.id)

    if (!error) {
      setPasswordUpdateSuccess('Admin password updated successfully!')
      setNewAdminPassword('')
      setConfirmAdminPassword('')
      setTimeout(() => setPasswordUpdateSuccess(''), 3000)
    }
  }

  // Create teacher account with PIN
  const createTeacherAccount = async () => {
    if (!currentSchool || !pinFormData.firstName || !pinFormData.lastName || !pinFormData.email) {
      setPinFormMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    try {
      const supabase = createClient()
      
      // Generate unique PIN
      const pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
      
      // Create teacher account
      const { data, error } = await supabase
        .from('teacher_accounts')
        .insert([{
          school_id: currentSchool.id,
          first_name: pinFormData.firstName,
          last_name: pinFormData.lastName,
          email: pinFormData.email,
          pin: pin,
          is_active: true
        }])
        .select()
        .single()

      if (error) {
        setPinFormMessage({ type: 'error', text: error.message })
        return
      }

      // Add to list
      setTeacherAccounts([...teacherAccounts, data])

      setPinFormMessage({ type: 'success', text: `Teacher account created! PIN: ${pin}. Now assign this teacher to classes/subjects, then email will be sent.` })
      setPinFormData({ firstName: '', lastName: '', email: '' })
      
      setTimeout(() => {
        setShowPINForm(false)
        setPinFormMessage(null)
      }, 3000)
    } catch (err) {
      setPinFormMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create account' })
    }
  }

  // Delete teacher account
  const deleteTeacherAccount = async (teacherId: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teacher_accounts')
        .delete()
        .eq('id', teacherId)

      if (error) throw error
      
      setTeacherAccounts(teacherAccounts.filter(t => t.id !== teacherId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  // Assign teacher to class/subject
  const assignTeacherToClass = async () => {
    if (!assignFormData.teacherId || !assignFormData.classId) {
      setAssignMessage({ type: 'error', text: 'Please select a teacher and class' })
      return
    }

    try {
      const supabase = createClient()
      console.log('[v0] Assigning teacher:', { assignFormData, schoolId: currentSchool?.id })

      const { data, error } = await supabase
        .from('teacher_assignments')
        .insert({
          school_id: currentSchool?.id,
          user_id: assignFormData.teacherId,
          class_id: assignFormData.classId,
          subject_id: assignFormData.subjectId || null,
          is_active: true
        })
        .select()

      if (error) {
        console.error('[v0] Assignment insert error:', error)
        // Check for duplicate constraint error
        if (error.message && error.message.includes('duplicate')) {
          setAssignMessage({ type: 'error', text: 'This teacher is already assigned to this class and subject' })
        } else {
          setAssignMessage({ type: 'error', text: error.message || 'Failed to create assignment' })
        }
        return
      }

      console.log('[v0] Assignment inserted:', data)

      // Reload assignments
      const { data: newAssignments } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('school_id', currentSchool?.id)

      console.log('[v0] Reloaded assignments:', newAssignments)

      if (newAssignments) {
        setTeacherAssignments(newAssignments)
      }

      // Get teacher and class details for email
      const teacher = teacherAccounts.find(t => t.id === assignFormData.teacherId)
      const selectedClass = classes.find(c => c.id === assignFormData.classId)
      const selectedSubject = assignFormData.subjectId ? subjects.find(s => s.id === assignFormData.subjectId) : null
      
      // Get all assignments for this teacher
      const teacherAllAssignments = newAssignments?.filter(a => a.user_id === assignFormData.teacherId) || []

      // Send email with assignment details
      try {
        await fetch('/api/send-teacher-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: teacher?.email,
            firstName: teacher?.first_name,
            lastName: teacher?.last_name,
            pin: teacher?.pin,
            schoolName: currentSchool?.name,
            assignments: teacherAllAssignments.map(a => {
              const classData = classes.find(c => c.id === a.class_id)
              const subjectData = a.subject_id ? subjects.find(s => s.id === a.subject_id) : null
              return {
                className: classData?.name || 'Unknown Class',
                subjectName: a.subject_id ? (subjectData?.name || 'Unknown Subject') : 'All Subjects'
              }
            })
          })
        })
      } catch (emailError) {
        console.warn('[v0] Email sending failed:', emailError)
      }

      setAssignMessage({ type: 'success', text: 'Assignment created and email sent to teacher with PIN + assignment details!' })
      setAssignFormData({ teacherId: '', classId: '', subjectId: '' })
      
      setTimeout(() => {
        setShowAssignForm(false)
        setAssignMessage(null)
      }, 2000)
    } catch (err) {
      setAssignMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create assignment' })
    }
  }

  // Delete assignment
  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm('Remove this assignment?')) return
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error
      
      setTeacherAssignments(teacherAssignments.filter(a => a.id !== assignmentId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete assignment')
    }
  }

  if (!currentSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  // Password screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center mb-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
              >
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold mb-2">Admin Portal</CardTitle>
              <CardDescription className="text-base text-gray-600">
                {currentSchool.name} - Restricted Access
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Admin Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isAuthenticating || !password}
                className="w-full h-11 text-white font-medium"
                style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
              >
                {isAuthenticating ? 'Verifying...' : 'Login as Admin'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/?school=${currentSchool.code}`)}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main Portal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filter deadlines based on selected filters
  const getFilteredDeadlines = () => {
    return deadlines.filter(d => {
      // Filter by class name
      if (deadlineFilters.className && d.class_name !== deadlineFilters.className) {
        return false
      }
      
      // Filter by exam type
      if (deadlineFilters.examType && d.exam_type !== deadlineFilters.examType) {
        return false
      }
      
      // Filter by status
      if (deadlineFilters.status === 'open' && (d.is_locked || d.deadline_date)) {
        return false
      }
      if (deadlineFilters.status === 'deadline-set' && (!d.deadline_date || d.is_locked)) {
        return false
      }
      if (deadlineFilters.status === 'locked' && !d.is_locked) {
        return false
      }
      
      return true
    })
  }

  const filteredDeadlines = getFilteredDeadlines()
  
  // Get unique class names and exam types for filter dropdowns
  const uniqueClasses = Array.from(new Set(deadlines.map(d => d.class_name))).sort()
  const uniqueExamTypes = Array.from(new Set(deadlines.map(d => d.exam_type))).sort()

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="text-white py-3 md:py-4 px-4 md:px-6 shadow-lg"
        style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-2 md:gap-3">
            {/* School Logo */}
            <img 
              src={currentSchool.logo_url || `/logos/${currentSchool.code}.png`}
              alt={`${currentSchool.name} logo`}
              className="w-10 md:w-12 h-10 md:h-12 object-contain bg-white rounded-lg p-1"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <Shield className="w-8 h-8 hidden" />
            <div className="flex-1">
              <h1 className="text-lg md:text-xl font-bold">{currentSchool.name}</h1>
              <p className="text-xs md:text-sm opacity-90">Admin Portal</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 justify-start md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccessClassesMenu(!showAccessClassesMenu)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs md:text-sm"
              title="Access any class without password"
            >
              📚 Access Classes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/?school=${currentSchool.code}`)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs md:text-sm"
            >
              Main Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAuthenticated(false)
                setPassword('')
                // Redirect to school's home page
                if (currentSchool) {
                  window.location.href = `/?school=${currentSchool.code}`
                }
              }}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Access Classes Menu */}
      {showAccessClassesMenu && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="font-semibold text-blue-900 mb-3">Select a Class to Access (Admin Mode)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => handleAccessClassAsAdmin(cls.id, cls.name)}
                  className="p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm"
                >
                  <div className="font-medium text-gray-900">{cls.name}</div>
                  <div className="text-xs text-gray-500 mt-1">Admin Access - No Password</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAccessClassesMenu(false)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-3 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <Tabs defaultValue="deadlines" className="space-y-3 md:space-y-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-9 w-full max-w-full gap-1 md:gap-0 h-auto md:h-10 p-1 md:p-1"
            >
              <TabsTrigger value="deadlines" className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2 md:py-0">
                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Deadlines</span>
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2 md:py-0">
                <GraduationCap className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Classes</span>
              </TabsTrigger>
              <TabsTrigger value="teachers" className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2 md:py-0">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Teachers</span>
              </TabsTrigger>
              {pinLoginEnabled && (
                <TabsTrigger value="pin-accounts" className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2 md:py-0 bg-purple-50 text-purple-700">
                  <Users className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden md:inline">T&A</span><span className="md:hidden">T&A</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="passwords" className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2 md:py-0">
                <Lock className="w-4 h-4" />
                Passwords
              </TabsTrigger>
              <TabsTrigger value="exams" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Exam Types
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Audit Logs
              </TabsTrigger>
            </TabsList>

            {/* Deadlines Tab */}
            <TabsContent value="deadlines">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Exam Sessions & Deadlines
                  </CardTitle>
                  <CardDescription>
                    Set deadlines and lock/unlock exam sessions created by teachers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Filter section */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                    <h3 className="font-medium text-gray-700">Filter Sessions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {/* Class filter */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Class</label>
                        <select
                          value={deadlineFilters.className}
                          onChange={(e) => setDeadlineFilters({ ...deadlineFilters, className: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Classes</option>
                          {uniqueClasses.map(className => (
                            <option key={className} value={className}>{className}</option>
                          ))}
                        </select>
                      </div>

                      {/* Exam type filter */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Exam Type</label>
                        <select
                          value={deadlineFilters.examType}
                          onChange={(e) => setDeadlineFilters({ ...deadlineFilters, examType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Types</option>
                          {uniqueExamTypes.map(examType => (
                            <option key={examType} value={examType}>{examType}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status filter */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <select
                          value={deadlineFilters.status}
                          onChange={(e) => setDeadlineFilters({ ...deadlineFilters, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Statuses</option>
                          <option value="open">Open</option>
                          <option value="deadline-set">Deadline Set</option>
                          <option value="locked">Locked</option>
                        </select>
                      </div>

                      {/* Clear filters */}
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeadlineFilters({ className: '', examType: '', status: '' })}
                          className="w-full"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Showing {filteredDeadlines.length} of {deadlines.length} sessions
                    </div>
                  </div>

                  {/* Exam sessions list - shows sessions created by teachers */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">All Exam Sessions</h3>
                    <p className="text-sm text-gray-500">These are exam sessions created by teachers. Set deadlines and lock/unlock as needed.</p>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 text-left font-medium text-gray-600">Class</th>
                            <th className="p-3 text-left font-medium text-gray-600">Exam</th>
                            <th className="p-3 text-left font-medium text-gray-600">Term/Year</th>
                            <th className="p-3 text-left font-medium text-gray-600">Status</th>
                            <th className="p-3 text-left font-medium text-gray-600">Deadline</th>
                            <th className="p-3 text-right font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDeadlines.map((d: any) => (
                            <tr key={d.id} className="border-t hover:bg-gray-50">
                              <td className="p-3 font-medium">{d.class_name || 'Unknown'}</td>
                              <td className="p-3">{d.exam_type || '-'}</td>
                              <td className="p-3">{d.term} {d.year}</td>
                              <td className="p-3">
                                {d.is_locked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                                    <Lock className="w-3 h-3" /> Locked
                                  </span>
                                ) : d.deadline_date ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700">
                                    <Clock className="w-3 h-3" /> Deadline Set
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                    <Unlock className="w-3 h-3" /> Open
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {editingDeadlineId === d.id ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="datetime-local"
                                      value={editingDeadlineValue}
                                      onChange={(e) => setEditingDeadlineValue(e.target.value)}
                                      className="w-48 h-8 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => saveSessionDeadline(d.id)}
                                      className="h-8 bg-green-600 hover:bg-green-700"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => { setEditingDeadlineId(null); setEditingDeadlineValue(''); }}
                                      className="h-8"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  d.deadline_date ? (
                                    <span className="text-sm">{new Date(d.deadline_date).toLocaleString()}</span>
                                  ) : (
                                    <span className="text-gray-400 text-sm">Not set</span>
                                  )
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1 justify-end flex-wrap md:flex-nowrap">
                                  {editingDeadlineId !== d.id && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant={d.is_locked ? 'outline' : 'default'}
                                        onClick={() => toggleSessionLock(d.id, d.is_locked)}
                                        className={`${d.is_locked ? '' : 'bg-red-500 hover:bg-red-600'} whitespace-nowrap text-xs md:text-sm px-2 md:px-3`}
                                        title={d.is_locked ? 'Unlock session' : 'Lock session'}
                                      >
                                        {d.is_locked ? (
                                          <><Unlock className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Unlock</span></>
                                        ) : (
                                          <><Lock className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Lock</span></>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => { setEditingDeadlineId(d.id); setEditingDeadlineValue(d.deadline_date ? new Date(d.deadline_date).toISOString().slice(0, 16) : ''); }}
                                        className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3"
                                        title="Set deadline"
                                      >
                                        <Calendar className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /><span className="hidden md:inline">Deadline</span>
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {filteredDeadlines.length === 0 && deadlines.length > 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-gray-500">
                                No exam sessions match your filters. Try adjusting your filter criteria.
                              </td>
                            </tr>
                          )}
                          {deadlines.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-gray-500">
                                No exam sessions created yet. Teachers create sessions when entering marks, or use the form above to create them.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Classes Tab */}
            <TabsContent value="classes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Manage Classes
                  </CardTitle>
                  <CardDescription>Add, remove, or create stream variants for classes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Add new class */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter class name (e.g., Grade 10, Form 1)"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addClass()}
                    />
                    <Button onClick={addClass} disabled={!newClassName.trim()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Class
                    </Button>
                  </div>

                  {/* Add stream to existing class */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                    <div>
                      <h3 className="font-medium text-blue-900">Manage Streams</h3>
                      <p className="text-xs text-blue-700 mt-1">Add or remove streams for grade levels</p>
                    </div>
                    
                    {/* Step 1: Select base class */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Select Grade Level</label>
                      <Select value={streamBaseClass} onValueChange={(value) => {
                        setStreamBaseClass(value)
                        setStreamError('')
                        setNewStreamName('')
                        // Get all streams for this base class
                        const baseStreams = getStreamsForBaseClass(classes, value)
                        setExistingStreams(baseStreams)
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a grade level..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getUniqueBaseClasses(classes).map(baseClass => (
                            <SelectItem key={baseClass.name} value={baseClass.name}>
                              {baseClass.name} {baseClass.streamCount > 1 ? `(${baseClass.streamCount} streams)` : '(no streams)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Step 2: Show existing streams and add new one */}
                    {streamBaseClass && (
                      <div className="space-y-3 p-3 bg-white rounded border">
                        {/* Existing streams list */}
                        {existingStreams.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-600 uppercase">Existing Streams</p>
                            <div className="flex flex-wrap gap-2">
                              {existingStreams.map(stream => {
                                const streamName = stream.name.replace(streamBaseClass, '').trim()
                                return (
                                  <div key={stream.id} className="flex items-center gap-2 px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg text-sm">
                                    <span className="font-medium">{streamBaseClass} {streamName}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        if (confirm(`Delete "${stream.name}"?\n\nThis will permanently remove this stream and all associated class data.`)) {
                                          const supabase = createClient()
                                          await supabase.from('classes').delete().eq('id', stream.id)
                                          const updated = classes.filter(c => c.id !== stream.id)
                                          setClasses(updated)
                                          setExistingStreams(updated.filter(c => getBaseClassName(c.name) === streamBaseClass))
                                        }
                                      }}
                                      className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Add new stream */}
                        <div className="pt-2 border-t space-y-2">
                          <p className="text-xs font-semibold text-gray-600 uppercase">Add New Stream</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Stream name (e.g., EAST, WEST, A, B)"
                              value={newStreamName}
                              onChange={(e) => {
                                setNewStreamName(e.target.value)
                                setStreamError('')
                              }}
                            />
                            <Button 
                              onClick={addStreamClass} 
                              disabled={!newStreamName.trim()}
                              size="sm"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {streamError && (
                      <div className="text-red-700 text-sm p-3 bg-red-100 rounded border border-red-300">
                        ⚠️ {streamError}
                      </div>
                    )}
                  </div>

                  {/* Class list */}
                  <div className="grid grid-cols-3 gap-3">
                    {sortClasses(classes).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        {editingClassId === c.id ? (
                          <div className="flex-1 flex gap-2">
                            <Input
                              value={editingClassName}
                              onChange={(e) => setEditingClassName(e.target.value)}
                              className="h-8 text-sm"
                              placeholder="Class name"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => saveEditClass(c.id)}
                              disabled={isSavingEdit}
                              className="h-8"
                            >
                              {isSavingEdit ? '...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditClass}
                              disabled={isSavingEdit}
                              className="h-8"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-sm">{c.name}</span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditClass(c.id, c.name)}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteClass(c.id, c.name)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {editError && (
                    <div className="text-red-600 text-sm p-3 bg-red-50 rounded border border-red-200 mt-3">
                      {editError}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passwords Tab */}
            <TabsContent value="passwords">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Manage Passwords
                  </CardTitle>
                  <CardDescription>Set or change passwords for classes and admin access</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {passwordUpdateSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                      {passwordUpdateSuccess}
                    </div>
                  )}

                  {/* Class Passwords */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Class Passwords
                    </h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 text-left">Class</th>
                            <th className="p-3 text-left">Current Password</th>
                            <th className="p-3 text-left">New Password</th>
                            <th className="p-3 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortClasses(classes).map(c => (
                            <tr key={c.id} className="border-t">
                              <td className="p-3 font-medium">{c.name}</td>
                              <td className="p-3">
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                  {c.password || 'Not set'}
                                </code>
                              </td>
                              <td className="p-3">
                                <Input
                                  type="text"
                                  placeholder="Enter new password"
                                  value={classPasswords[c.id] || ''}
                                  onChange={(e) => setClassPasswords(prev => ({ 
                                    ...prev, 
                                    [c.id]: e.target.value 
                                  }))}
                                  className="w-48"
                                />
                              </td>
                              <td className="p-3">
                                <Button
                                  size="sm"
                                  onClick={() => updateClassPassword(c.id)}
                                  disabled={!classPasswords[c.id]?.trim()}
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Update
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Admin Password */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin Portal Password
                    </h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
                      <p className="text-sm text-amber-700">
                        This password is used to access this Admin Portal. Change it carefully.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">New Admin Password</label>
                          <Input
                            type="password"
                            placeholder="Enter new password"
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Confirm Password</label>
                          <Input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmAdminPassword}
                            onChange={(e) => setConfirmAdminPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={updateAdminPassword}
                        disabled={!newAdminPassword || !confirmAdminPassword}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Update Admin Password
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teachers Tab */}
            <TabsContent value="teachers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Assign Class Teachers
                  </CardTitle>
                  <CardDescription>Set the class teacher for each class (shown on report cards)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {teacherUpdateSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                      {teacherUpdateSuccess}
                    </div>
                  )}
                  
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-3 text-left">Class</th>
                          <th className="p-3 text-left">Current Teacher</th>
                          <th className="p-3 text-left">Teacher Name</th>
                          <th className="p-3 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortClasses(classes).map(c => (
                          <tr key={c.id} className="border-t">
                            <td className="p-3 font-medium">{c.name}</td>
                            <td className="p-3">
                              <span className={c.teacher_name ? "text-green-600 font-medium" : "text-gray-400 italic"}>
                                {c.teacher_name || 'Not assigned'}
                              </span>
                            </td>
                            <td className="p-3">
                              <Input
                                type="text"
                                placeholder="Enter teacher name"
                                value={classTeachers[c.id] ?? c.teacher_name ?? ''}
                                onChange={(e) => setClassTeachers(prev => ({ 
                                  ...prev, 
                                  [c.id]: e.target.value 
                                }))}
                                className="w-56"
                              />
                            </td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                onClick={() => updateClassTeacher(c.id)}
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    The class teacher name will appear on student report cards for CBC primary schools.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teachers & Assignments Tab - Unified */}
            {pinLoginEnabled && (
              <TabsContent value="pin-accounts">
                <TeachersUnified 
                  schoolId={currentSchool?.id || ''} 
                  schoolName={currentSchool?.name || ''} 
                  whatsappEnabled={currentSchool?.feature_whatsapp_reports === true}
                />
              </TabsContent>
            )}

            {/* Assignments are now integrated into Teachers unified tab */}

            {/* Exam Types Tab */}
            <TabsContent value="exams">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Manage Exam Types
                  </CardTitle>
                  <CardDescription>Add custom exam types like CAT, Weekly Test, etc.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div>
                      <Label className="text-xs">Exam Type Name</Label>
                      <Input
                        placeholder="e.g., CAT 1, Weekly Test"
                        value={newExamType}
                        onChange={(e) => setNewExamType(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addExamType()}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Year</Label>
                      <select
                        value={newExamTypeYear}
                        onChange={(e) => setNewExamTypeYear(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Term</Label>
                      <select
                        value={newExamTypeTerm}
                        onChange={(e) => setNewExamTypeTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addExamType} disabled={!newExamType.trim()} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2 p-3 bg-gray-100 rounded-lg font-semibold text-sm">
                      <span>Exam Type</span>
                      <span>Year</span>
                      <span>Term</span>
                      <span></span>
                      <span></span>
                    </div>
                    {examTypes.map(e => (
                      <div key={e.id} className="grid grid-cols-5 gap-2 p-3 bg-gray-50 rounded-lg items-center text-sm">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-gray-600">{e.year || '-'}</span>
                        <span className="text-gray-600">{e.term || '-'}</span>
                        <span></span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExamType(e.id)}
                          disabled={deletingExamTypeId === e.id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete exam type"
                        >
                          {deletingExamTypeId === e.id ? (
                            <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="space-y-6">
                {/* School Logo Upload */}
                {school && (
                  <Card>
                    <CardHeader>
                      <CardTitle>School Logo</CardTitle>
                      <CardDescription>Upload and manage your school's logo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SchoolLogoUploader
                        schoolId={school.id}
                        schoolName={school.name}
                        currentLogoUrl={school.logo_url}
                        onUploadSuccess={(logoUrl) => {
                          setSchool({ ...school, logo_url: logoUrl })
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* School Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      School Information
                    </CardTitle>
                    <CardDescription>Update school information and branding</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                  {school && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">School Name</label>
                          <Input
                            value={school.name}
                            onChange={(e) => setSchool({ ...school, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Short Name</label>
                          <Input
                            value={school.short_name || ''}
                            onChange={(e) => setSchool({ ...school, short_name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tagline / Motto</label>
                        <Input
                          value={school.tagline || ''}
                          onChange={(e) => setSchool({ ...school, tagline: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Email</label>
                          <Input
                            type="email"
                            value={school.email || ''}
                            onChange={(e) => setSchool({ ...school, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Phone</label>
                          <Input
                            value={school.phone || ''}
                            onChange={(e) => setSchool({ ...school, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Address</label>
                        <Input
                          value={school.address || ''}
                          onChange={(e) => setSchool({ ...school, address: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Brand Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={school.primary_color || '#2563eb'}
                            onChange={(e) => setSchool({ ...school, primary_color: e.target.value })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <Input
                            value={school.primary_color || '#2563eb'}
                            onChange={(e) => setSchool({ ...school, primary_color: e.target.value })}
                            className="w-32"
                          />
                        </div>
                      </div>

                      <Button onClick={updateSchoolSettings} className="w-full">
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                      </Button>
                    </>
                  )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Audit Logs Tab */}
            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Audit Logs
                  </CardTitle>
                  <CardDescription>View all actions performed in the system with precise PIN identification</CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No audit logs yet</p>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {auditLogs.map((log: any) => (
                        <div key={log.id} className="border rounded-lg p-4 bg-white hover:shadow-lg transition-shadow">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              {/* Action Badge */}
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm capitalize bg-blue-600 text-white px-3 py-1 rounded">
                                  {log.action?.replace(/_/g, ' ')}
                                </span>
                              </div>

                              {/* Teacher PIN */}
                              <div className="bg-yellow-100 border border-yellow-400 p-2 rounded">
                                <p className="text-sm font-mono font-bold text-yellow-800">
                                  Teacher PIN: {log.teacher_pin || 'Unknown'}
                                </p>
                              </div>

                              {/* What they did */}
                              {log.details && (
                                <p className="text-sm text-gray-700">
                                  {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                                </p>
                              )}
                            </div>

                            {/* When */}
                            <div className="text-right text-xs text-gray-500">
                              <p>{new Date(log.created_at).toLocaleDateString()}</p>
                              <p>{new Date(log.created_at).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Class</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the class <strong>{classToDelete?.name}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <div className="text-red-600 text-sm p-2 bg-red-50 rounded border border-red-200">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 justify-end mt-4">
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button
                onClick={confirmDeleteClass}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete Class'}
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Admin PWA Installation Banner */}
        <AdminPWARegistration schoolId={school?.id} schoolName={school?.name} />
      </main>
    </div>
  )
}
