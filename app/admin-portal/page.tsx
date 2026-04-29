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
  Shield, Eye, EyeOff, Settings, Users, BookOpen, Calendar, 
  Clock, FileText, Plus, Trash2, Save, ArrowLeft, Lock, Unlock,
  GraduationCap, ClipboardList, History
} from 'lucide-react'
import type { Class, ExamType } from '@/lib/types'

const TERMS = ['Term 1', 'Term 2', 'Term 3']

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
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectCode, setNewSubjectCode] = useState('')
  
  // Stream management
  const [streamBaseClass, setStreamBaseClass] = useState('')
  const [newStreamName, setNewStreamName] = useState('')

  // Deadline form
  const [deadlineClass, setDeadlineClass] = useState('')
  const [deadlineExamType, setDeadlineExamType] = useState('')
  const [deadlineTerm, setDeadlineTerm] = useState('Term 1')
  const [deadlineYear, setDeadlineYear] = useState(new Date().getFullYear())
  const [deadlineDate, setDeadlineDate] = useState('')

  // Password management
  const [classPasswords, setClassPasswords] = useState<{[key: string]: string}>({})
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('')
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('')

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
      // No school selected and no school code in URL - redirect to school selection
      router.push('/select-school')
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
    } else {
      router.push('/select-school')
    }
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
        .from('audit_logs')
        .select('*, classes(name), sessions(term, year, exam_types(name))')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (logsData) {
        setAuditLogs(logsData.map((log: any) => ({
          id: log.id,
          action: log.action,
          details: log.details,
          performed_by: log.performed_by,
          class_name: log.classes?.name,
          session_info: log.sessions ? `${log.sessions.exam_types?.name || ''} - ${log.sessions.term} ${log.sessions.year}` : '',
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

  // Delete class
  const deleteClass = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (!error) {
      setClasses(classes.filter(c => c.id !== id))
    }
  }

  // Add stream class (e.g., "Grade 5 East" from base class "Grade 5")
  const addStreamClass = async () => {
    if (!streamBaseClass || !newStreamName.trim() || !currentSchool) return
    
    const streamClassName = `${streamBaseClass} ${newStreamName.trim()}`
    
    // Check if class already exists
    if (classes.some(c => c.name === streamClassName)) {
      alert('This stream class already exists!')
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
      
      setClasses([...classes, data])
      setStreamBaseClass('')
      setNewStreamName('')
    }
  }

  // Add subject
  const addSubject = async () => {
    if (!newSubjectName.trim() || !currentSchool) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('subjects')
      .insert({ 
        name: newSubjectName.trim(),
        code: newSubjectCode.trim() || newSubjectName.substring(0, 3).toUpperCase(),
        school_id: currentSchool.id
      })
      .select()
      .single()

    if (!error && data) {
      setSubjects([...subjects, data])
      setNewSubjectName('')
      setNewSubjectCode('')
    }
  }

  // Delete subject
  const deleteSubject = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (!error) {
      setSubjects(subjects.filter(s => s.id !== id))
    }
  }

  // Set deadline for a class/term
  const setDeadline = async () => {
    if (!deadlineClass || !deadlineExamType || !deadlineDate || !currentSchool) return

    const supabase = createClient()
    
    // Check if session exists with this class, exam type, term, and year
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_id', deadlineClass)
      .eq('exam_type_id', deadlineExamType)
      .eq('term', deadlineTerm)
      .eq('year', deadlineYear)
      .single()

    if (existingSession) {
      // Update existing session with deadline datetime
      await supabase
        .from('sessions')
        .update({ deadline_datetime: deadlineDate })
        .eq('id', existingSession.id)
    } else {
      // Create new session with exam type and deadline
      await supabase
        .from('sessions')
        .insert({
          class_id: deadlineClass,
          exam_type_id: deadlineExamType,
          term: deadlineTerm,
          year: deadlineYear,
          deadline_datetime: deadlineDate,
          is_locked: false,
          school_id: currentSchool.id
        })
    }

    loadAdminData()
    setDeadlineClass('')
    setDeadlineExamType('')
    setDeadlineDate('')
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

  // Update school settings
  const updateSchoolSettings = async () => {
    if (!school || !currentSchool) return

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
        primary_color: school.primary_color,
      })
      .eq('id', currentSchool.id)

    if (!error) {
      setCurrentSchool({ ...currentSchool, ...school })
      alert('School settings updated!')
    }
  }

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
            <Shield className="w-8 h-8" />
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
            <TabsList className="grid grid-cols-7 w-full max-w-4xl">
              <TabsTrigger value="deadlines" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Deadlines
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Classes
              </TabsTrigger>
              <TabsTrigger value="passwords" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Passwords
              </TabsTrigger>
              <TabsTrigger value="subjects" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Subjects
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
                    Set Deadlines & Lock Sessions
                  </CardTitle>
                  <CardDescription>
                    Set submission deadlines and lock/unlock marking sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Add deadline form */}
                  <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
                    <Select value={deadlineClass} onValueChange={setDeadlineClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={deadlineExamType} onValueChange={setDeadlineExamType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Exam type" />
                      </SelectTrigger>
                      <SelectContent>
                        {examTypes.map(et => (
                          <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={deadlineTerm} onValueChange={setDeadlineTerm}>
                      <SelectTrigger>
                        <SelectValue placeholder="Term" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={deadlineYear}
                      onChange={(e) => setDeadlineYear(parseInt(e.target.value))}
                      placeholder="Year"
                    />

                    <Input
                      type="datetime-local"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                    />

                    <Button onClick={setDeadline} disabled={!deadlineClass || !deadlineExamType || !deadlineDate}>
                      <Plus className="w-4 h-4 mr-2" />
                      Set Deadline
                    </Button>
                  </div>

                  {/* Active sessions */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">Active Sessions</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 text-left">Class</th>
                            <th className="p-3 text-left">Exam Type</th>
                            <th className="p-3 text-left">Term/Year</th>
                            <th className="p-3 text-left">Deadline</th>
                            <th className="p-3 text-left">Status</th>
                            <th className="p-3 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deadlines.map((d: any) => (
                            <tr key={d.id} className="border-t">
                              <td className="p-3">{d.class_name || 'Unknown'}</td>
                              <td className="p-3">{d.exam_type || '-'}</td>
                              <td className="p-3">{d.term} {d.year}</td>
                              <td className="p-3">
                                {d.deadline_date ? new Date(d.deadline_date).toLocaleString() : '-'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  d.is_locked 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {d.is_locked ? 'Locked' : 'Open'}
                                </span>
                              </td>
                              <td className="p-3">
                                <Button
                                  size="sm"
                                  variant={d.is_locked ? 'default' : 'outline'}
                                  onClick={() => toggleSessionLock(d.id, d.is_locked)}
                                >
                                  {d.is_locked ? (
                                    <><Unlock className="w-4 h-4 mr-1" /> Unlock</>
                                  ) : (
                                    <><Lock className="w-4 h-4 mr-1" /> Lock</>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {deadlines.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-gray-500">
                                No active sessions yet
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
                      <Select value={streamBaseClass} onValueChange={setStreamBaseClass}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select base class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Stream name (e.g., East, A)"
                        value={newStreamName}
                        onChange={(e) => setNewStreamName(e.target.value)}
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
                  </div>

                  {/* Class list */}
                  <div className="grid grid-cols-3 gap-3">
                    {classes.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <span className="font-medium text-sm">{c.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteClass(c.id)}
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
                          {classes.map(c => (
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

            {/* Subjects Tab */}
            <TabsContent value="subjects">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Manage Subjects
                  </CardTitle>
                  <CardDescription>Add or remove subjects for this school</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Subject name"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Code (e.g., MAT)"
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      className="w-32"
                    />
                    <Button onClick={addSubject} disabled={!newSubjectName.trim()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Subject
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {subjects.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({s.code})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSubject(s.id)}
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
      </main>
    </div>
  )
}
