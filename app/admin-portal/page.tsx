'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { getTemplatesForLevel, type SubjectLevel } from '@/lib/subject-templates'
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
  GraduationCap, ClipboardList, History, Edit, Users, X, Upload, Image as ImageIcon
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

  // Auth state
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('')
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('')
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
  const [classPasswords, setClassPasswords] = useState<{[key: string]: string}>({})
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // School selection state for linked schools
  const [linkedSchools, setLinkedSchools] = useState<School[]>([])
  const [activeSchoolTab, setActiveSchoolTab] = useState<string | null>(null)
  const [allSchoolsData, setAllSchoolsData] = useState<{[schoolId: string]: {classes: Class[], examTypes: ExamType[], subjects: any[]}}>({})

  // Class teacher management
  const [classTeachers, setClassTeachers] = useState<{[key: string]: string}>({})
  const [teacherUpdateSuccess, setTeacherUpdateSuccess] = useState('')

  // Curriculum configuration
  const [schoolLevel, setSchoolLevel] = useState<'grade-1-3' | 'grade-4-6' | 'jss'>('grade-1-3')
  const [useSsre, setUseSsre] = useState(false)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [customSubjects, setCustomSubjects] = useState<Array<{name: string; code: string}>>([])
  const [customSubjectName, setCustomSubjectName] = useState('')
  const [customSubjectCode, setCustomSubjectCode] = useState('')
  
  // Session management
  const [showArchivedSessions, setShowArchivedSessions] = useState(false)

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
    // Don't reset authentication - user already authenticated with the password
    
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
        // Check for linked schools (both parent and child)
        let linkedSchoolsList: School[] = []
        
        // If this is a Primary school, find linked JSS schools
        const { data: jssLinked } = await supabase
          .from('schools')
          .select('*')
          .eq('parent_school_id', schoolData.id)
        
        // If this is a JSS school, find the parent Primary school
        let parentSchool: School | null = null
        if (schoolData.parent_school_id) {
          const { data: parent } = await supabase
            .from('schools')
            .select('*')
            .eq('id', schoolData.parent_school_id)
            .single()
          parentSchool = parent
        }
        
        // Compile linked schools
        if (jssLinked && jssLinked.length > 0) {
          linkedSchoolsList = [schoolData, ...jssLinked]
        } else if (parentSchool) {
          linkedSchoolsList = [parentSchool, schoolData]
        } else {
          linkedSchoolsList = [schoolData]
        }
        
        // Set authenticated and load all schools' data
        setSchool(schoolData)
        setIsAuthenticated(true)
        setLinkedSchools(linkedSchoolsList)
        setActiveSchoolTab(schoolData.id) // Start with current school
        
        // Load data for all linked schools with the initial school ID
        await loadAllLinkedSchoolsData(linkedSchoolsList, schoolData.id)
      } else {
        setPasswordError('Incorrect admin password')
      }
    } catch {
      setPasswordError('An error occurred. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  // Load data for all linked schools at once
  const loadAllLinkedSchoolsData = async (schools: School[], initialSchoolId: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const dataMap: {[schoolId: string]: {classes: Class[], examTypes: ExamType[], subjects: any[], sessions: any[]}} = {}
      
      // Load data for each linked school in parallel
      const promises = schools.map(async (schoolData) => {
        const [classesRes, examTypesRes, subjectsRes, sessionsRes] = await Promise.all([
          supabase.from('classes').select('*').eq('school_id', schoolData.id).order('display_order'),
          supabase.from('exam_types').select('*').eq('school_id', schoolData.id).order('name'),
          supabase.from('subjects').select('*').eq('school_id', schoolData.id).order('name'),
          supabase.from('sessions').select('*').eq('school_id', schoolData.id).eq('is_active', true).order('created_at', { ascending: false }),
        ])
        
        dataMap[schoolData.id] = {
          classes: classesRes.data || [],
          examTypes: examTypesRes.data || [],
          subjects: subjectsRes.data || [],
          sessions: sessionsRes.data || [],
        }
      })
      
      await Promise.all(promises)
      setAllSchoolsData(dataMap)
      
      // Set initial tab data immediately after loading
      if (initialSchoolId && dataMap[initialSchoolId]) {
        const activeData = dataMap[initialSchoolId]
        setClasses(activeData.classes)
        setExamTypes(activeData.examTypes)
        setSubjects(activeData.subjects)
        setDeadlines(activeData.sessions)
      }
    } catch (err) {
      console.error('[v0] Error loading all schools data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Switch tab to different school
  const handleSwitchSchoolTab = (schoolId: string) => {
    setActiveSchoolTab(schoolId)
    const activeData = allSchoolsData[schoolId]
    if (activeData) {
      setClasses(activeData.classes)
      setExamTypes(activeData.examTypes)
      setSubjects(activeData.subjects)
      setDeadlines(activeData.sessions)
    } else {
      // Load global subjects for this school if not cached
      loadGlobalSubjects()
    }
  }

  // Add exam type
  const addExamType = async () => {
    if (!newExamType.trim() || !currentSchool) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('exam_types')
      .insert({ name: newExamType.trim(), school_id: activeSchoolTab || currentSchool?.id })
      .select()
      .single()

    if (!error && data) {
      // Update the current display
      setExamTypes([...examTypes, data])
      setNewExamType('')
      
      // Also update the cached data for this school
      const schoolId = activeSchoolTab || currentSchool?.id
      if (schoolId) {
        setAllSchoolsData(prev => ({
          ...prev,
          [schoolId]: {
            ...prev[schoolId],
            examTypes: [...(prev[schoolId]?.examTypes || []), data]
          }
        }))
      }
    }
  }

  // Delete exam type
  const deleteExamType = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('exam_types').delete().eq('id', id)
    if (!error) {
      // Update display
      setExamTypes(examTypes.filter(e => e.id !== id))
      
      // Update cache
      const schoolId = activeSchoolTab || currentSchool?.id
      if (schoolId) {
        setAllSchoolsData(prev => ({
          ...prev,
          [schoolId]: {
            ...prev[schoolId],
            examTypes: prev[schoolId]?.examTypes?.filter(e => e.id !== id) || []
          }
        }))
      }
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
        school_id: activeSchoolTab || currentSchool?.id,
        password: 'welcome',
        display_order: classes.length + 1
      })
      .select()
      .single()

    if (!error && data) {
      // Update display
      setClasses([...classes, data])
      setNewClassName('')
      
      // Update cache
      const schoolId = activeSchoolTab || currentSchool?.id
      if (schoolId) {
        setAllSchoolsData(prev => ({
          ...prev,
          [schoolId]: {
            ...prev[schoolId],
            classes: [...(prev[schoolId]?.classes || []), data]
          }
        }))
      }
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
          school_id: activeSchoolTab || currentSchool?.id,
          password: 'welcome',
          display_order: classes.length + 1
        })
        .select()
        .single()

      if (error) throw error
      
      if (data) {
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
        school_id: activeSchoolTab || currentSchool?.id
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

  // Archive/Unarchive session
  const toggleSessionArchive = async (sessionId: string, currentState: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: !currentState })
      .eq('id', sessionId)
    
    if (!error) {
      loadAdminData()
      setShowArchivedSessions(false)
    }
  }

  // Toggle subject enabled/disabled status
  const toggleSubjectStatus = async (subjectId: string, isCurrentlyDisabled: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('subjects')
      .update({ is_disabled: !isCurrentlyDisabled })
      .eq('id', subjectId)
    
    if (!error) {
      // Update local state
      setSubjects(subjects.map(s => 
        s.id === subjectId ? { ...s, is_disabled: !isCurrentlyDisabled } : s
      ))
    }
  }

  // Load global subjects for the school
  const loadGlobalSubjects = async () => {
    const schoolId = activeSchoolTab || currentSchool?.id
    if (!schoolId) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('global_subjects')
      .select('*')
      .eq('school_id', schoolId)
      .order('name')

    if (!error && data) {
      setSubjects(data)
    }
  }

  // Add all Kenyan CBC subjects to school
  const quickSetupAllSubjects = async () => {
    const schoolId = activeSchoolTab || currentSchool?.id
    if (!schoolId) return

    try {
      const supabase = createClient()
      const allSubjects = getTemplatesForLevel('all')

      // Insert all subjects for this school in global_subjects
      const { data, error } = await supabase
        .from('global_subjects')
        .insert(
          allSubjects.map(subject => ({
            name: subject.name,
            code: subject.code,
            school_id: schoolId,
            is_disabled: false,
            is_custom: false,
          }))
        )
        .select()

      if (error) throw error

      // Update local state
      setSubjects([...subjects, ...(data || [])])
      alert(`Successfully added ${data?.length || 0} subjects for your school`)
    } catch (error) {
      console.error('[v0] Error seeding subjects:', error)
      alert('Failed to add subjects: ' + (error as any)?.message)
    }
  }

  // Toggle subject enabled/disabled status
  const toggleSubjectStatus = async (subjectId: string, isCurrentlyDisabled: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('global_subjects')
      .update({ is_disabled: !isCurrentlyDisabled })
      .eq('id', subjectId)
    
    if (!error) {
      // Update local state
      setSubjects(subjects.map(s => 
        s.id === subjectId ? { ...s, is_disabled: !isCurrentlyDisabled } : s
      ))
    }
  }
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

  // Get available subjects for current level
  const getAvailableSubjects = () => {
    const templates = getTemplatesForLevel(schoolLevel as SubjectLevel)
    
    // Filter based on SSRE preference
    if (!useSsre) {
      // Remove SSRE, keep SST
      return templates.filter(t => t.code !== 'SSRE')
    } else {
      // Remove SST, keep SSRE
      return templates.filter(t => t.code !== 'SST' || t.isVariant)
    }
  }

  // Add custom subject with validation
  const addCustomSubject = () => {
    if (!customSubjectName || !customSubjectCode) {
      alert('Please enter both subject name and code')
      return
    }

    // Check for duplicates
    if (customSubjects.some(s => s.code === customSubjectCode)) {
      alert('This code is already in use')
      return
    }

    if (selectedSubjects.includes(customSubjectCode)) {
      alert('This code conflicts with a preset subject')
      return
    }

    // Confirm before adding
    if (window.confirm(`Add "${customSubjectName}" (${customSubjectCode}) to your custom subjects?`)) {
      setCustomSubjects([...customSubjects, {name: customSubjectName, code: customSubjectCode}])
      setCustomSubjectName('')
      setCustomSubjectCode('')
    }
  }

  // Save curriculum configuration
  const saveCurriculumConfiguration = async () => {
    if (selectedSubjects.length === 0 && customSubjects.length === 0) {
      alert('Please select at least one subject')
      return
    }

    const schoolId = activeSchoolTab || currentSchool?.id
    if (!schoolId) return

    try {
      const supabase = createClient()
      
      // Prepare subjects for database insertion
      const allSelectedSubjects = [
        ...getAvailableSubjects()
          .filter(s => selectedSubjects.includes(s.code))
          .map(s => ({ name: s.name, code: s.code, is_custom: false })),
        ...customSubjects.map(s => ({ name: s.name, code: s.code, is_custom: true }))
      ]

      // Delete existing subjects for this school
      await supabase.from('subjects').delete().eq('school_id', schoolId)

      // Insert new subjects
      const { error } = await supabase.from('subjects').insert(
        allSelectedSubjects.map(s => ({
          name: s.name,
          code: s.code,
          is_custom: s.is_custom,
          school_id: schoolId
        }))
      )

      if (error) throw error

      // Update curriculum configuration flag
      await supabase
        .from('schools')
        .update({ curriculum_configured: true, school_level: schoolLevel })
        .eq('id', schoolId)

      alert('Curriculum configuration saved successfully!')
      // Reload the subjects in the main subjects list
      const activeData = allSchoolsData[schoolId]
      if (activeData) {
        setSubjects(allSelectedSubjects.map((s, i) => ({ id: `subject-${i}`, ...s })))
      }
    } catch (error) {
      console.error('[v0] Error saving curriculum:', error)
      alert('Failed to save curriculum configuration')
    }
  }

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB')
      return
    }

    try {
      // Use Vercel Blob for storage
      const formData = new FormData()
      formData.append('file', file)
      formData.append('schoolCode', currentSchool?.code || '')
      
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) throw new Error('Upload failed')
      const { url } = await response.json()
      
      // Update school with logo URL
      setSchool({ ...school, logo_url: url })
      await updateSchoolLogo(url)
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo. Please try again.')
    }
  }

  // Update school logo in database
  const updateSchoolLogo = async (logoUrl: string) => {
    const supabase = createClient()
    const schoolId = activeSchoolTab || currentSchool?.id
    if (!schoolId) return

    try {
      const { error } = await supabase
        .from('schools')
        .update({ logo_url: logoUrl })
        .eq('id', schoolId)

      if (error) throw error
      console.log('[v0] Logo updated successfully')
    } catch (error) {
      console.error('Error updating logo:', error)
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
        className="text-white py-4 px-6 shadow-lg border-b-4"
        style={{ 
          backgroundColor: currentSchool.primary_color || '#2563eb',
          borderBottomColor: activeSchoolTab === currentSchool.id ? 
            (currentSchool.school_type === 'primary' ? '#3b82f6' : '#10b981') : 
            (currentSchool.school_type === 'primary' ? '#1e40af' : '#047857')
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* School Logo */}
            <img 
              src={currentSchool.logo_url || `/logos/${currentSchool.code}.png`}
              alt={`${currentSchool.name} logo`}
              className="w-14 h-14 object-contain bg-white rounded-lg p-1 shadow"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <Shield className="w-10 h-10 hidden text-white/80" />
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{currentSchool.name}</h1>
                {/* School Section Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                  activeSchoolTab === currentSchool.id ? 
                    (currentSchool.school_type === 'primary' ? 'bg-blue-500' : 'bg-green-500') :
                    (currentSchool.school_type === 'primary' ? 'bg-blue-400' : 'bg-green-400')
                }`}>
                  {currentSchool.section_name || (currentSchool.school_type === 'primary' ? 'Primary' : 'Junior Secondary')}
                </span>
                {/* School Code */}
                <span className="text-xs text-white/70 font-mono">{currentSchool.code}</span>
              </div>
              <p className="text-sm opacity-90">Admin Portal - {activeSchoolTab === currentSchool.id ? 'Currently Viewing' : 'Archived'}</p>
            </div>
            
            {/* School Tabs - Show if there are linked schools */}
            {linkedSchools.length > 1 && (
              <div className="flex items-center gap-2 ml-4 border-l border-white/30 pl-4">
                <span className="text-xs opacity-75 font-medium">SWITCH SECTION:</span>
                {linkedSchools.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSwitchSchoolTab(s.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all transform ${
                      activeSchoolTab === s.id
                        ? 'bg-white text-blue-600 shadow-lg scale-105'
                        : 'bg-white/20 text-white hover:bg-white/30 hover:scale-102'
                    }`}
                    title={`Switch to ${s.section_name}`}
                  >
                    {s.section_name || 'School'}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/?school=${currentSchool.code}`)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              title="Go to student portal"
            >
              Student Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAuthenticated(false)
                setPassword('')
                window.location.href = `/?school=${currentSchool.code}`
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
          <Tabs defaultValue="curriculum" className="space-y-6">
            <TabsList className="grid grid-cols-8 w-full max-w-6xl">
              <TabsTrigger value="curriculum" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Curriculum
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

            {/* Curriculum Setup Tab - Admin Enables Subjects */}
            <TabsContent value="curriculum">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Curriculum Management
                  </CardTitle>
                  <CardDescription>
                    Enable or disable subjects that teachers can assign to their classes. Teachers will only see enabled subjects when entering marks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Quick Setup for All Subjects */}
                  {subjects.length === 0 && (
                    <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3">
                      <div>
                        <h3 className="font-semibold text-blue-900 mb-2">Quick Setup - Add All Kenyan CBC Subjects (PP1-Grade 9)</h3>
                        <p className="text-sm text-blue-800 mb-4">
                          Add all available subjects for your school. Then disable the ones you don't offer. Teachers will only see enabled subjects when selecting for their classes.
                        </p>
                      </div>
                      <Button
                        onClick={() => quickSetupAllSubjects()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add All Available Subjects
                      </Button>
                    </div>
                  )}

                  {/* Active Subjects */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold">Enabled Subjects</label>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{subjects.filter(s => !s.is_disabled).length} active</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {subjects.filter(s => !s.is_disabled).map(subject => (
                        <div
                          key={subject.id}
                          className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between group hover:shadow-md transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{subject.name}</div>
                            <div className="text-xs text-gray-600 font-mono">{subject.code}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleSubjectStatus(subject.id, true)}
                            className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-700 hover:bg-amber-50 ml-2"
                            title="Disable subject"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {subjects.filter(s => !s.is_disabled).length === 0 && (
                        <div className="col-span-full p-8 text-center text-gray-400">
                          No active subjects. Enable subjects below.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t"></div>

                  {/* Disabled Subjects - Can Re-enable */}
                  {subjects.filter(s => s.is_disabled).length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-gray-600">Disabled Subjects</label>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{subjects.filter(s => s.is_disabled).length} disabled</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {subjects.filter(s => s.is_disabled).map(subject => (
                          <div
                            key={subject.id}
                            className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between group hover:shadow-md transition-all opacity-60"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate line-through">{subject.name}</div>
                              <div className="text-xs text-gray-500 font-mono">{subject.code}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleSubjectStatus(subject.id, false)}
                              className="opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-700 hover:bg-green-50 ml-2"
                              title="Enable subject"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>How it works:</strong> Enabled subjects appear in the teacher portal. Teachers select which of these enabled subjects they teach in each class. The enabled subjects become available in the mark entry interface.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

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

                      {/* Logo Upload Section */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">School Logo</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          {school.logo_url ? (
                            <div className="space-y-4">
                              <img
                                src={school.logo_url}
                                alt="School logo"
                                className="w-24 h-24 object-contain mx-auto"
                              />
                              <div className="flex gap-2 justify-center">
                                <label className="cursor-pointer">
                                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    <Upload className="w-4 h-4" />
                                    Change Logo
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleLogoUpload(e)}
                                    className="hidden"
                                  />
                                </label>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSchool({ ...school, logo_url: '' })
                                    updateSchoolLogo('')
                                  }}
                                >
                                  Remove Logo
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="py-8 space-y-4">
                              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
                              <div>
                                <p className="font-medium text-gray-700">Upload School Logo</p>
                                <p className="text-sm text-gray-500">PNG, JPG or GIF (Max 2MB)</p>
                              </div>
                              <label className="cursor-pointer">
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                  <Upload className="w-4 h-4" />
                                  Choose File
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleLogoUpload(e)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}
                        </div>
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
