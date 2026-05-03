'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
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
  GraduationCap, ClipboardList, History, Edit, Users, X
} from 'lucide-react'
import type { Class, ExamType } from '@/lib/types'

const TERMS = ['Term 1', 'Term 2', 'Term 3']

// Helper to sort classes: PP1, PP2, then Grade 1, 2, 3... with streams alphabetically
function sortClasses(classes: Class[]): Class[] {
  const getClassOrder = (name: string) => {
    const match = name.match(/^(PP\d+|Grade\s*\d+|Form\s*\d+)(?:\s+(.+))?$/i)
    if (!match) return { order: 999, streamOrder: name }
    
    const baseName = match[1].toUpperCase()
    const stream = match[2] || ''
    
    if (baseName.startsWith('PP')) {
      const num = parseInt(baseName.replace('PP', '')) || 0
      return { order: num, streamOrder: stream }
    }
    
    if (baseName.includes('GRADE')) {
      const num = parseInt(baseName.replace(/GRADE\s*/i, '')) || 0
      return { order: 10 + num, streamOrder: stream }
    }
    
    if (baseName.includes('FORM')) {
      const num = parseInt(baseName.replace(/FORM\s*/i, '')) || 0
      return { order: 100 + num, streamOrder: stream }
    }
    
    return { order: 999, streamOrder: name }
  }
  
  return [...classes].sort((a, b) => {
    const orderA = getClassOrder(a.name)
    const orderB = getClassOrder(b.name)
    if (orderA.order !== orderB.order) return orderA.order - orderB.order
    return orderA.streamOrder.localeCompare(orderB.streamOrder)
  })
}

// Helper to extract base class name (e.g., "Grade 7" from "Grade 7 EAST")
function getBaseClassName(className: string): string {
  const match = className.match(/^(PP\d+|Grade\s*\d+|Form\s*\d+)(?:\s+(.+))?$/i)
  return match ? match[1] : className
}

// Helper to get all unique base classes (shows base class once even if it has streams)
function getBaseClasses(classes: Class[]): Class[] {
  const baseClassMap = new Map<string, Class>()
  
  classes.forEach(cls => {
    const baseName = getBaseClassName(cls.name)
    // Only add the base class once - keep the first occurrence (the actual base class without stream)
    if (!baseClassMap.has(baseName)) {
      baseClassMap.set(baseName, cls)
    }
  })
  
  const baseClasses = Array.from(baseClassMap.values())
  return sortClasses(baseClasses)
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
  const [subjects, setSubjects] = useState<any[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [newExamType, setNewExamType] = useState('')
  const [newClassName, setNewClassName] = useState('')
  
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

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

      const [classesRes, examTypesRes, subjectsRes] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order'),
        supabase.from('exam_types').select('*').eq('school_id', currentSchool.id).order('name'),
        supabase.from('subjects').select('*').eq('school_id', currentSchool.id).order('name'),
      ])

      if (classesRes.data) setClasses(classesRes.data)
      if (examTypesRes.data) setExamTypes(examTypesRes.data)
      if (subjectsRes.data) setSubjects(subjectsRes.data)

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

      // Load audit logs
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
          class_name: '',
          session_info: '',
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
      .insert({ name: newExamType.trim(), school_id: currentSchool.id })
      .select()
      .single()

    if (!error && data) {
      setExamTypes([...examTypes, data])
      setNewExamType('')
    }
  }

  // Delete exam type
  const deleteExamType = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('exam_types').delete().eq('id', id)
    if (!error) {
      setExamTypes(examTypes.filter(e => e.id !== id))
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

  // Add stream class (e.g., "Grade 5 East" from base class "Grade 5")
  const addStreamClass = async () => {
    if (!streamBaseClass || !newStreamName.trim() || !currentSchool) return
    
    const streamClassName = `${streamBaseClass} ${newStreamName.trim()}`
    
    // Check if class already exists
    if (classes.some(c => c.name === streamClassName)) {
      setStreamError(`Stream "${streamClassName}" already exists!`)
      return
    }
    
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

    if (!error && data) {
      // Also create base sessions for the new stream class
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
      
      const updatedClasses = [...classes, data]
      setClasses(updatedClasses)
      
      // Update existing streams list
      const newExistingStreams = updatedClasses.filter(c => getBaseClassName(c.name) === streamBaseClass)
      setExistingStreams(newExistingStreams)
      
      setStreamBaseClass('')
      setNewStreamName('')
      setStreamError('')
    } else if (error) {
      setStreamError(`Failed to create stream: ${error.message}`)
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
      .update({ deadline_datetime: editingDeadlineValue })
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

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="text-white py-4 px-6 shadow-lg"
        style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* School Logo */}
            <img 
              src={currentSchool.logo_url || `/logos/${currentSchool.code}.png`}
              alt={`${currentSchool.name} logo`}
              className="w-12 h-12 object-contain bg-white rounded-lg p-1"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <Shield className="w-8 h-8 hidden" />
            <div>
              <h1 className="text-xl font-bold">{currentSchool.name}</h1>
              <p className="text-sm opacity-90">Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/?school=${currentSchool.code}`)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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

      <main className="max-w-7xl mx-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <Tabs defaultValue="deadlines" className="space-y-6">
            <TabsList className="grid grid-cols-8 w-full max-w-5xl">
              <TabsTrigger value="deadlines" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Deadlines
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Classes
              </TabsTrigger>
              <TabsTrigger value="teachers" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Teachers
              </TabsTrigger>
              <TabsTrigger value="passwords" className="flex items-center gap-2">
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
                  {/* Exam sessions list - shows sessions created by teachers */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">All Exam Sessions</h3>
                    <p className="text-sm text-gray-500">These are exam sessions created by teachers. Set deadlines and lock/unlock as needed.</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
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
                          {deadlines.map((d: any) => (
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
                                        onClick={() => { setEditingDeadlineId(d.id); setEditingDeadlineValue(d.deadline_date || ''); }}
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
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <h3 className="font-medium text-blue-800 text-sm">Add Stream to Class</h3>
                    <p className="text-xs text-blue-600">Create stream variants like "Grade 5 East", "Grade 5 West"</p>
                    <div className="flex gap-2">
                      <Select value={streamBaseClass} onValueChange={(value) => {
                        setStreamBaseClass(value)
                        setStreamError('')
                        setNewStreamName('')
                        // Get all streams for this base class
                        const baseStreams = classes.filter(c => getBaseClassName(c.name) === value)
                        setExistingStreams(baseStreams)
                      }}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select base class" />
                        </SelectTrigger>
                        <SelectContent>
                          {getBaseClasses(classes).map(c => {
                            const streamCount = classes.filter(cls => getBaseClassName(cls.name) === c.name).length
                            return (
                              <SelectItem key={c.id} value={c.name}>
                                {c.name} {streamCount > 1 ? `(${streamCount} streams)` : '(no streams yet)'}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Stream name (e.g., East, A)"
                        value={newStreamName}
                        onChange={(e) => {
                          setNewStreamName(e.target.value)
                          setStreamError('')
                        }}
                        className="flex-1"
                      />
                      <Button 
                        onClick={addStreamClass} 
                        disabled={!streamBaseClass || !newStreamName.trim()}
                        variant="secondary"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Stream
                      </Button>
                    </div>
                    
                    {/* Show existing streams for selected base class */}
                    {streamBaseClass && existingStreams.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Existing streams for {streamBaseClass}:</p>
                        <div className="flex flex-wrap gap-2">
                          {existingStreams.map(stream => (
                            <div key={stream.id} className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-full text-sm">
                              <span>{stream.name}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  if (confirm(`Delete stream "${stream.name}"? This will remove the stream and all associated data.`)) {
                                    const supabase = createClient()
                                    await supabase.from('classes').delete().eq('id', stream.id)
                                    setClasses(classes.filter(c => c.id !== stream.id))
                                    setExistingStreams(existingStreams.filter(s => s.id !== stream.id))
                                  }
                                }}
                                className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {streamError && (
                      <div className="text-red-600 text-sm p-3 bg-red-50 rounded border border-red-200">
                        {streamError}
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
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
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
                  
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
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
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter exam type (e.g., CAT 1, Weekly Test, Assignment)"
                      value={newExamType}
                      onChange={(e) => setNewExamType(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addExamType()}
                    />
                    <Button onClick={addExamType} disabled={!newExamType.trim()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Exam Type
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {examTypes.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">{e.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExamType(e.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    School Settings
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
            </TabsContent>

            {/* Audit Logs Tab */}
            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Audit Logs
                  </CardTitle>
                  <CardDescription>View all actions performed in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No audit logs yet</p>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {auditLogs.map((log: any) => (
                        <div key={log.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm capitalize">
                                  {log.action?.replace(/_/g, ' ')}
                                </span>
                                {log.class_name && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                    {log.class_name}
                                  </span>
                                )}
                                {log.session_info && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                    {log.session_info}
                                  </span>
                                )}
                              </div>
                              {log.details && (
                                <p className="text-xs text-gray-600">
                                  {typeof log.details === 'object' 
                                    ? JSON.stringify(log.details) 
                                    : log.details}
                                </p>
                              )}
                              <p className="text-xs text-gray-400">
                                By: {log.performed_by || 'Unknown'}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
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
      </main>
    </div>
  )
}
