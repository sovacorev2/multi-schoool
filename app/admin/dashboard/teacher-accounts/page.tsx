'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Mail, Copy, Check, Search, X } from 'lucide-react'
import { useSchool } from '@/lib/school-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TeacherAccount {
  id: string
  email: string
  first_name: string
  last_name: string
  pin: string
  is_active: boolean
  email_sent: boolean
  created_at: string
}

interface Class {
  id: string
  name: string
}

export default function TeacherAccountsPage() {
  const { currentSchool } = useSchool()
  const [teachers, setTeachers] = useState<TeacherAccount[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [teacherClasses, setTeacherClasses] = useState<Record<string, string[]>>({}) // teacher_id -> class_ids
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [copiedPin, setCopiedPin] = useState<string | null>(null)
  const [pinLoginEnabled, setPinLoginEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  // Check if PIN login is enabled for this school
  useEffect(() => {
    if (currentSchool) {
      const hasPinLogin = (currentSchool as any)?.enable_pin_login === true
      setPinLoginEnabled(hasPinLogin)
    }
  }, [currentSchool])
  
  // Form state - SIMPLIFIED: No password!
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchTeachers()
  }, [currentSchool])

  async function fetchTeachers() {
    if (!currentSchool?.id) return
    
    setIsLoading(true)
    try {
      // Fetch all teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('teacher_accounts')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false })

      if (teachersError) throw teachersError
      setTeachers(teachersData || [])

      // Fetch all classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', currentSchool.id)
        .order('name', { ascending: true })

      if (classesError) throw classesError
      setClasses(classesData || [])

      // Fetch teacher assignments to map teachers to classes
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, class_id')
        .in('teacher_id', (teachersData || []).map(t => t.id))

      if (assignmentsError) throw assignmentsError
      
      // Build teacher -> classes mapping
      const mapping: Record<string, string[]> = {}
      if (assignmentsData) {
        for (const assignment of assignmentsData) {
          if (!mapping[assignment.teacher_id]) {
            mapping[assignment.teacher_id] = []
          }
          if (!mapping[assignment.teacher_id].includes(assignment.class_id)) {
            mapping[assignment.teacher_id].push(assignment.class_id)
          }
        }
      }
      setTeacherClasses(mapping)
    } catch (error) {
      console.error('[v0] Error fetching teachers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    setIsSubmitting(true)

    try {
      // Validate - NO PASSWORD REQUIRED
      if (!formData.email || !formData.firstName) {
        throw new Error('Please fill in First Name and Email')
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address')
      }

      // Generate unique 4-digit PIN
      let pin = ''
      let isUnique = false
      
      while (!isUnique) {
        pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
        // Check if PIN already exists
        const { data: existing } = await supabase
          .from('teacher_accounts')
          .select('id')
          .eq('pin', pin)
          .eq('school_id', currentSchool?.id)
        
        isUnique = !existing || existing.length === 0
      }

      // Create account WITHOUT password - just use PIN
      const { data, error } = await supabase
        .from('teacher_accounts')
        .insert([{
          school_id: currentSchool?.id,
          email: formData.email.toLowerCase(),
          first_name: formData.firstName,
          last_name: formData.lastName || '',
          pin: pin,
          password: '', // Empty password - PIN is the credential
        }])
        .select()

      if (error) {
        if (error.message.includes('unique')) {
          throw new Error('This email is already registered')
        }
        throw error
      }

      // Send welcome email with PIN from shuletech1@gmail.com
      try {
        const emailResponse = await fetch('/api/send-teacher-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName || '',
            pin: pin,
            schoolName: currentSchool?.name || 'ShuleTech',
            senderEmail: 'shuletech1@gmail.com',
          }),
        })

        if (!emailResponse.ok) {
          console.warn('[v0] Email sending failed but teacher account created')
        }
      } catch (emailError) {
        console.warn('[v0] Email error:', emailError)
      }

      setFormSuccess(`✅ Teacher "${formData.firstName}" registered with PIN: ${pin}. Email sent to ${formData.email}`)
      setFormData({ email: '', firstName: '', lastName: '' })
      setShowAddForm(false)
      await fetchTeachers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create teacher account')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteTeacher(id: string) {
    if (!confirm('Are you sure you want to delete this teacher account?')) return

    try {
      const { error } = await supabase
        .from('teacher_accounts')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setFormSuccess('Teacher account deleted')
      await fetchTeachers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete teacher')
    }
  }

  async function handleResendEmail(teacher: TeacherAccount) {
    try {
      const emailResponse = await fetch('/api/send-teacher-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: teacher.email,
          firstName: teacher.first_name,
          lastName: teacher.last_name,
          pin: teacher.pin,
          schoolName: currentSchool?.name || 'ShuleTech',
          senderEmail: 'shuletech1@gmail.com',
        }),
      })

      if (emailResponse.ok) {
        setFormSuccess(`Email resent to ${teacher.email}`)
        // Update email_sent flag
        await supabase
          .from('teacher_accounts')
          .update({ email_sent: true })
          .eq('id', teacher.id)
        await fetchTeachers()
      } else {
        setFormError('Failed to resend email')
      }
    } catch (error) {
      setFormError('Error resending email')
    }
  }

  function copyToClipboard(pin: string) {
    navigator.clipboard.writeText(pin)
    setCopiedPin(pin)
    setTimeout(() => setCopiedPin(null), 2000)
  }

  // Filter and search teachers
  const filteredTeachers = teachers.filter((teacher) => {
    // Search by name or PIN
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = searchQuery === '' ||
      teacher.first_name.toLowerCase().includes(searchLower) ||
      teacher.last_name.toLowerCase().includes(searchLower) ||
      teacher.pin.includes(searchQuery)

    // Filter by class
    const matchesClass = !selectedClass ||
      (teacherClasses[teacher.id] && teacherClasses[teacher.id].includes(selectedClass))

    return matchesSearch && matchesClass
  })

  if (!pinLoginEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher PIN Accounts</h1>
          <p className="text-gray-600">PIN-based teacher authentication is not enabled for your school</p>
        </div>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900">Feature Not Enabled</CardTitle>
          </CardHeader>
          <CardContent className="text-yellow-800">
            <p>The PIN-based teacher login system is currently available for selected pilot schools only.</p>
            <p className="mt-2">Contact support to enable this feature for your school.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher PIN Accounts</h1>
          <p className="text-gray-600 mt-1">Register teachers with auto-generated PIN codes</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Register New Teacher
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>How it works:</strong> Teachers are registered with their name and email only. The system generates a unique 4-digit PIN. An email is sent to the teacher with their PIN and login instructions. No password is required.
          </p>
        </CardContent>
      </Card>

      {/* Messages */}
      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {formError}
        </div>
      )}
      {formSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {formSuccess}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Register New Teacher</CardTitle>
            <CardDescription>Enter teacher details. PIN will be auto-generated and emailed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTeacher} className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Ochieng"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.ochieng@shuletech.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Email where PIN will be sent</p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Register Teacher'}
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

      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Teachers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <Label htmlFor="search" className="mb-2 block">Search by Name or PIN</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search teacher name or PIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Class Filter */}
            <div className="flex-1">
              <Label htmlFor="class-filter" className="mb-2 block">Filter by Class</Label>
              <Select value={selectedClass || ''} onValueChange={(value) => setSelectedClass(value || null)}>
                <SelectTrigger id="class-filter">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || selectedClass) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedClass(null)
                  }}
                  className="w-full sm:w-auto"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Teachers ({filteredTeachers.length} of {teachers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading teachers...</p>
          ) : teachers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No teachers registered yet. Register your first teacher above.</p>
          ) : filteredTeachers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No teachers match your search or filter criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>PIN Code</TableHead>
                    <TableHead>Assigned Classes</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        {teacher.first_name} {teacher.last_name}
                      </TableCell>
                      <TableCell className="text-sm">{teacher.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-mono font-bold text-lg bg-gray-100 px-3 py-1 rounded">
                            {teacher.pin}
                          </div>
                          <button
                            onClick={() => copyToClipboard(teacher.pin)}
                            className="text-gray-500 hover:text-gray-700"
                            title="Copy PIN"
                          >
                            {copiedPin === teacher.pin ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {teacherClasses[teacher.id]?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {teacherClasses[teacher.id].map(classId => {
                              const className = classes.find(c => c.id === classId)?.name
                              return (
                                <Badge key={classId} variant="secondary" className="text-xs">
                                  {className}
                                </Badge>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {teacher.email_sent ? (
                          <Badge className="bg-green-100 text-green-800">Sent</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(teacher.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <button
                          onClick={() => handleResendEmail(teacher)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                          title="Resend email"
                        >
                          <Mail className="w-4 h-4 inline mr-1" />
                          Resend
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(teacher.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete teacher"
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
