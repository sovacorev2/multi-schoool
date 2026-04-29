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
  GraduationCap, ClipboardList
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

  // Deadline form
  const [deadlineClass, setDeadlineClass] = useState('')
  const [deadlineTerm, setDeadlineTerm] = useState('Term 1')
  const [deadlineYear, setDeadlineYear] = useState(new Date().getFullYear())
  const [deadlineDate, setDeadlineDate] = useState('')

  // Load school from URL or context
  useEffect(() => {
    const schoolCode = searchParams.get('school')
    if (schoolCode && !currentSchool) {
      loadSchoolFromCode(schoolCode)
    } else if (!currentSchool) {
      router.push('/select-school')
    }
  }, [searchParams, currentSchool])

  const loadSchoolFromCode = async (code: string) => {
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

      // Load deadlines from sessions
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*, classes(name)')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false })

      if (sessionsData) {
        setDeadlines(sessionsData.map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          term: s.term,
          year: s.year,
          deadline_date: s.deadline_date || '',
          is_locked: s.is_locked,
          class_name: s.classes?.name
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
        display_order: classes.length + 1
      })
      .select()
      .single()

    if (!error && data) {
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
    if (!deadlineClass || !deadlineDate || !currentSchool) return

    const supabase = createClient()
    
    // Check if session exists
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_id', deadlineClass)
      .eq('term', deadlineTerm)
      .eq('year', deadlineYear)
      .single()

    if (existingSession) {
      // Update existing
      await supabase
        .from('sessions')
        .update({ deadline_date: deadlineDate })
        .eq('id', existingSession.id)
    } else {
      // Create new session with deadline
      await supabase
        .from('sessions')
        .insert({
          class_id: deadlineClass,
          term: deadlineTerm,
          year: deadlineYear,
          deadline_date: deadlineDate,
          is_locked: false,
          school_id: currentSchool.id
        })
    }

    loadAdminData()
    setDeadlineClass('')
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
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="deadlines" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Deadlines
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Classes
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
                  <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
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
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                    />

                    <Button onClick={setDeadline} disabled={!deadlineClass || !deadlineDate}>
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
                            <th className="p-3 text-left">Term</th>
                            <th className="p-3 text-left">Year</th>
                            <th className="p-3 text-left">Deadline</th>
                            <th className="p-3 text-left">Status</th>
                            <th className="p-3 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deadlines.map((d: any) => (
                            <tr key={d.id} className="border-t">
                              <td className="p-3">{d.class_name || 'Unknown'}</td>
                              <td className="p-3">{d.term}</td>
                              <td className="p-3">{d.year}</td>
                              <td className="p-3">
                                {d.deadline_date ? new Date(d.deadline_date).toLocaleDateString() : '-'}
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
                  <CardDescription>Add or remove classes for this school</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="grid grid-cols-4 gap-3">
                    {classes.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">{c.name}</span>
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
          </Tabs>
        )}
      </main>
    </div>
  )
}
