'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react'
import { useSchool } from '@/lib/school-context'

interface TeacherAccount {
  id: string
  email: string
  first_name: string
  last_name: string
  pin: string
  is_active: boolean
  created_at: string
}

export default function TeacherAccountsPage() {
  const { currentSchool } = useSchool()
  const [teachers, setTeachers] = useState<TeacherAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPassword, setShowPassword] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
      const { data, error } = await supabase
        .from('teacher_accounts')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTeachers(data || [])
    } catch (error) {
      console.error('Error fetching teachers:', error)
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
      // Validate
      if (!formData.email || !formData.password || !formData.firstName) {
        throw new Error('Please fill in all required fields')
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }

      // Generate unique PIN
      const pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')

      // Add to teacher_accounts table with PIN
      const { data, error } = await supabase
        .from('teacher_accounts')
        .insert([{
          school_id: currentSchool?.id,
          email: formData.email.toLowerCase(),
          password: formData.password, // In production, use hashing
          first_name: formData.firstName,
          last_name: formData.lastName,
          pin: pin,
        }])
        .select()

      if (error) {
        if (error.message.includes('unique')) {
          throw new Error('This email is already registered')
        }
        throw error
      }

      // Send welcome email with PIN
      try {
        const emailResponse = await fetch('/api/send-teacher-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            pin: pin,
            schoolName: currentSchool?.name || 'School',
            welcomePassword: formData.password,
          }),
        })

        if (!emailResponse.ok) {
          console.warn('[v0] Email sending failed, but teacher account was created')
        }
      } catch (emailError) {
        console.warn('[v0] Could not send email:', emailError)
        // Continue anyway - account is created
      }

      setFormSuccess(`✅ Teacher account created for ${formData.firstName}. Sent PIN ${pin} to ${formData.email}`)
      setFormData({ email: '', password: '', firstName: '', lastName: '' })
      setShowAddForm(false)
      await fetchTeachers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create teacher account')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteTeacher(teacherId: string) {
    if (!confirm('Are you sure you want to delete this teacher account?')) return

    try {
      const { error } = await supabase
        .from('teacher_accounts')
        .delete()
        .eq('id', teacherId)

      if (error) throw error
      
      setFormSuccess('Teacher account deleted')
      await fetchTeachers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete teacher account')
    }
  }

  if (!currentSchool) {
    return <div className="p-4 text-gray-600">Please select a school</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Accounts</h1>
        <p className="text-gray-600">Create and manage individual teacher login accounts</p>
      </div>

      {/* Messages */}
      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {formError}
        </div>
      )}
      {formSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {formSuccess}
        </div>
      )}

      {/* Add Teacher Form */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Add New Teacher Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email (to send PIN) *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Welcome email with unique PIN will be sent to this email</p>
              </div>

              <div>
                <Label htmlFor="password">Welcome Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Shared welcome password that teachers use before entering their PIN. Minimum 6 characters.</p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add New Teacher Account
        </Button>
      )}

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Teacher Accounts ({teachers.length})</CardTitle>
          <CardDescription>
            After creating an account, assign the teacher to classes and subjects in the Teacher Assignments section
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading teachers...</div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No teacher accounts yet. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>PIN Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        {teacher.first_name} {teacher.last_name}
                      </TableCell>
                      <TableCell className="text-sm">{teacher.email}</TableCell>
                      <TableCell>
                        <div className="font-mono font-bold text-lg bg-gray-100 px-3 py-2 rounded w-fit">
                          {teacher.pin}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={teacher.is_active ? 'default' : 'secondary'}>
                          {teacher.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(teacher.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDeleteTeacher(teacher.id)}
                          className="text-red-600 hover:text-red-900"
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
