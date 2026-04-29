'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Check, School, Loader2, Copy, ExternalLink } from 'lucide-react'

export default function SetupSchoolPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  // School form data
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    code: '',
    tagline: '',
    email: '',
    phone: '',
    address: '',
    primary_color: '#2563eb',
    admin_password: '',
    confirm_password: '',
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Auto-generate code from name
      if (field === 'name' && !prev.code) {
        updated.code = value
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 20)
      }
      
      // Auto-generate short name from name
      if (field === 'name' && !prev.short_name) {
        const words = value.split(' ').filter(w => w.length > 0)
        updated.short_name = words.map(w => w[0]?.toUpperCase() || '').join('').substring(0, 5)
      }
      
      return updated
    })
  }

  const validateForm = () => {
    if (!formData.name.trim()) return 'School name is required'
    if (!formData.code.trim()) return 'School code is required'
    if (formData.code.includes(' ')) return 'School code cannot contain spaces'
    if (!formData.admin_password) return 'Admin password is required'
    if (formData.admin_password.length < 6) return 'Password must be at least 6 characters'
    if (formData.admin_password !== formData.confirm_password) return 'Passwords do not match'
    return null
  }

  const handleCreateSchool = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()

      // Check if school code already exists
      const { data: existingSchool } = await supabase
        .from('schools')
        .select('id')
        .eq('code', formData.code)
        .single()

      if (existingSchool) {
        setError('A school with this code already exists. Please choose a different code.')
        setIsLoading(false)
        return
      }

      // Create the school
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name: formData.name,
          short_name: formData.short_name,
          code: formData.code,
          tagline: formData.tagline,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          primary_color: formData.primary_color,
          admin_password: formData.admin_password,
          is_active: true,
        })
        .select()
        .single()

      if (schoolError) throw schoolError

      // Copy St James' configuration - get all classes, subjects, exam_types
      const { data: stjamesSchool } = await supabase
        .from('schools')
        .select('id')
        .eq('code', 'stjames')
        .single()

      if (stjamesSchool) {
        // Copy classes from St James
        const { data: stjamesClasses } = await supabase
          .from('classes')
          .select('name, display_order')
          .eq('school_id', stjamesSchool.id)
          .order('display_order')

        if (stjamesClasses && stjamesClasses.length > 0) {
          const newClasses = stjamesClasses.map(c => ({
            name: c.name,
            display_order: c.display_order,
            school_id: school.id,
          }))
          await supabase.from('classes').insert(newClasses)
        }

        // Copy subjects from St James
        const { data: stjamesSubjects } = await supabase
          .from('subjects')
          .select('name, code')
          .eq('school_id', stjamesSchool.id)

        if (stjamesSubjects && stjamesSubjects.length > 0) {
          const newSubjects = stjamesSubjects.map(s => ({
            name: s.name,
            code: s.code,
            school_id: school.id,
          }))
          await supabase.from('subjects').insert(newSubjects)
        }

        // Copy exam types from St James
        const { data: stjamesExamTypes } = await supabase
          .from('exam_types')
          .select('name')
          .eq('school_id', stjamesSchool.id)

        if (stjamesExamTypes && stjamesExamTypes.length > 0) {
          const newExamTypes = stjamesExamTypes.map(e => ({
            name: e.name,
            school_id: school.id,
          }))
          await supabase.from('exam_types').insert(newExamTypes)
        }

        // Copy streams from St James (if any)
        const { data: stjamesStreams } = await supabase
          .from('streams')
          .select('name')
          .eq('school_id', stjamesSchool.id)

        if (stjamesStreams && stjamesStreams.length > 0) {
          const newStreams = stjamesStreams.map(s => ({
            name: s.name,
            school_id: school.id,
          }))
          await supabase.from('streams').insert(newStreams)
        }
      } else {
        // If St James doesn't exist, create default configuration
        const defaultClasses = [
          { name: 'PP1', display_order: 1, school_id: school.id },
          { name: 'PP2', display_order: 2, school_id: school.id },
          { name: 'Grade 1', display_order: 3, school_id: school.id },
          { name: 'Grade 2', display_order: 4, school_id: school.id },
          { name: 'Grade 3', display_order: 5, school_id: school.id },
          { name: 'Grade 4', display_order: 6, school_id: school.id },
          { name: 'Grade 5', display_order: 7, school_id: school.id },
          { name: 'Grade 6', display_order: 8, school_id: school.id },
          { name: 'Grade 7', display_order: 9, school_id: school.id },
          { name: 'Grade 8', display_order: 10, school_id: school.id },
          { name: 'Grade 9', display_order: 11, school_id: school.id },
        ]
        await supabase.from('classes').insert(defaultClasses)

        const defaultSubjects = [
          { name: 'Mathematics', code: 'MAT', school_id: school.id },
          { name: 'English', code: 'ENG', school_id: school.id },
          { name: 'Kiswahili', code: 'KIS', school_id: school.id },
          { name: 'Science', code: 'SCI', school_id: school.id },
          { name: 'Social Studies', code: 'SST', school_id: school.id },
          { name: 'CRE', code: 'CRE', school_id: school.id },
          { name: 'Creative Arts', code: 'CRA', school_id: school.id },
          { name: 'Agriculture', code: 'AGR', school_id: school.id },
          { name: 'Pre-Technical Studies', code: 'PTS', school_id: school.id },
          { name: 'Integrated Science', code: 'INT', school_id: school.id },
        ]
        await supabase.from('subjects').insert(defaultSubjects)

        const defaultExamTypes = [
          { name: 'Opener', school_id: school.id },
          { name: 'Mid-Term', school_id: school.id },
          { name: 'End-Term', school_id: school.id },
        ]
        await supabase.from('exam_types').insert(defaultExamTypes)
      }

      // Generate the school link
      const baseUrl = window.location.origin
      const schoolLink = `${baseUrl}/?school=${formData.code}`
      setGeneratedLink(schoolLink)
      setSuccess(true)

    } catch (err) {
      console.error('Error creating school:', err)
      setError('Failed to create school. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = generatedLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-green-700">School Created Successfully!</CardTitle>
            <CardDescription className="text-base">
              {formData.name} is now ready to use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium text-gray-600">School Access Link</Label>
              <div className="flex gap-2">
                <Input 
                  value={generatedLink} 
                  readOnly 
                  className="bg-white font-mono text-sm"
                />
                <Button onClick={copyToClipboard} variant="outline" size="icon">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Share this link with the school. They will use it to access their exam system.
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-blue-800">Login Credentials</p>
              <p className="text-sm text-blue-700">Password: <span className="font-mono">{formData.admin_password}</span></p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">What was configured:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>All classes (PP1 to Grade 9)</li>
                <li>All subjects (same as St James Koteko)</li>
                <li>Exam types (Opener, Mid-Term, End-Term)</li>
                <li>Streams (if configured in St James)</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => router.push('/select-school')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Schools
              </Button>
              <Button 
                className="flex-1"
                onClick={() => window.open(generatedLink, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open School
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/select-school')}
            className="w-fit -ml-2 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <School className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Add New School</CardTitle>
              <CardDescription>
                Set up a new school with the same system as St James Koteko
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">School Name *</Label>
            <Input
              id="name"
              placeholder="e.g., ABC Primary School"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="short_name">Short Name</Label>
              <Input
                id="short_name"
                placeholder="e.g., ABCPS"
                value={formData.short_name}
                onChange={(e) => handleInputChange('short_name', e.target.value)}
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">School Code *</Label>
              <Input
                id="code"
                placeholder="e.g., abc-primary"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              />
              <p className="text-xs text-gray-500">Used in the school URL</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">School Motto/Tagline</Label>
            <Input
              id="tagline"
              placeholder="e.g., Excellence in Education"
              value={formData.tagline}
              onChange={(e) => handleInputChange('tagline', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="school@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+254..."
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="School location"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_color">Brand Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="primary_color"
                value={formData.primary_color}
                onChange={(e) => handleInputChange('primary_color', e.target.value)}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <Input
                value={formData.primary_color}
                onChange={(e) => handleInputChange('primary_color', e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <hr className="my-4" />

          <div className="space-y-2">
            <Label htmlFor="admin_password">Admin Password *</Label>
            <Input
              id="admin_password"
              type="password"
              placeholder="Min 6 characters"
              value={formData.admin_password}
              onChange={(e) => handleInputChange('admin_password', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm Password *</Label>
            <Input
              id="confirm_password"
              type="password"
              placeholder="Re-enter password"
              value={formData.confirm_password}
              onChange={(e) => handleInputChange('confirm_password', e.target.value)}
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium mb-1">What will be created:</p>
            <p>The school will get the same setup as St James Koteko - all classes, subjects, and exam types will be automatically configured.</p>
          </div>

          <Button 
            onClick={handleCreateSchool} 
            className="w-full"
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating School...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create School
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
