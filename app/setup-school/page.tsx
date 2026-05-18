'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Check, School, Loader2, Copy, ExternalLink, Plus, X, Upload, ImageIcon } from 'lucide-react'
import Image from 'next/image'

// Default classes
const ALL_CLASSES = [
  { name: 'PP1', display_order: 1 },
  { name: 'PP2', display_order: 2 },
  { name: 'Grade 1', display_order: 3 },
  { name: 'Grade 2', display_order: 4 },
  { name: 'Grade 3', display_order: 5 },
  { name: 'Grade 4', display_order: 6 },
  { name: 'Grade 5', display_order: 7 },
  { name: 'Grade 6', display_order: 8 },
  { name: 'Grade 7', display_order: 9 },
  { name: 'Grade 8', display_order: 10 },
  { name: 'Grade 9', display_order: 11 },
]

// Default subjects (will be copied from St James or use these)
const DEFAULT_SUBJECTS = [
  { name: 'Mathematics', code: 'MAT' },
  { name: 'English', code: 'ENG' },
  { name: 'Kiswahili', code: 'KIS' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SST' },
  { name: 'CRE', code: 'CRE' },
  { name: 'Creative Arts', code: 'CRA' },
  { name: 'Agriculture', code: 'AGR' },
  { name: 'Pre-Technical Studies', code: 'PTS' },
  { name: 'Integrated Science', code: 'INT' },
]

export default function SetupSchoolPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')

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

  // Classes selection (toggle on/off)
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    ALL_CLASSES.map(c => c.name) // All selected by default
  )
  const [customClassName, setCustomClassName] = useState('')
  
  // Streams for classes (e.g., "Grade 5" -> ["East", "West"])
  const [classStreams, setClassStreams] = useState<Record<string, string[]>>({})
  const [newStreamInput, setNewStreamInput] = useState<Record<string, string>>({})
  
  const addStreamToClass = (className: string) => {
    const streamName = newStreamInput[className]?.trim()
    if (streamName && !classStreams[className]?.includes(streamName)) {
      setClassStreams(prev => ({
        ...prev,
        [className]: [...(prev[className] || []), streamName]
      }))
      setNewStreamInput(prev => ({ ...prev, [className]: '' }))
    }
  }
  
  const removeStreamFromClass = (className: string, streamName: string) => {
    setClassStreams(prev => ({
      ...prev,
      [className]: (prev[className] || []).filter(s => s !== streamName)
    }))
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setLogoError('Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('File too large. Maximum size is 5MB.')
      return
    }

    setLogoError('')
    setLogoFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadLogo = async (schoolCode: string): Promise<string | null> => {
    if (!logoFile) return null

    setIsUploadingLogo(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', logoFile)
      formDataUpload.append('schoolCode', schoolCode)

      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url } = await response.json()
      setLogoUrl(url)
      return url
    } catch (err) {
      console.error('Logo upload error:', err)
      setLogoError(err instanceof Error ? err.message : 'Failed to upload logo')
      return null
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoUrl(null)
    setLogoError('')
  }

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

  const toggleClass = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className)
        ? prev.filter(c => c !== className)
        : [...prev, className]
    )
  }

  const addCustomClass = () => {
    const trimmed = customClassName.trim()
    if (trimmed && !selectedClasses.includes(trimmed)) {
      setSelectedClasses(prev => [...prev, trimmed])
      setCustomClassName('')
    }
  }

  const removeCustomClass = (className: string) => {
    setSelectedClasses(prev => prev.filter(c => c !== className))
  }

  const validateStep1 = () => {
    if (!formData.name.trim()) return 'School name is required'
    if (!formData.code.trim()) return 'School code is required'
    if (formData.code.includes(' ')) return 'School code cannot contain spaces'
    if (!formData.admin_password) return 'Admin password is required'
    if (formData.admin_password.length < 6) return 'Password must be at least 6 characters'
    if (formData.admin_password !== formData.confirm_password) return 'Passwords do not match'
    return null
  }

  const validateStep2 = () => {
    if (selectedClasses.length === 0) return 'Select at least one class'
    return null
  }

  const handleNext = () => {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
    }
    setStep(prev => prev + 1)
  }

  const handleBack = () => {
    setError('')
    setStep(prev => prev - 1)
  }

  const handleCreateSchool = async () => {
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      console.log('[v0] Starting school creation...')

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

      // Upload logo if selected
      let uploadedLogoUrl: string | null = null
      if (logoFile) {
        console.log('[v0] Uploading school logo...')
        uploadedLogoUrl = await uploadLogo(formData.code)
        if (!uploadedLogoUrl && logoFile) {
          // Logo upload failed but we had a file - warn but continue
          console.warn('[v0] Logo upload failed, continuing without logo')
        }
      }

      // Create the school
      console.log('[v0] Creating school with data:', {
        name: formData.name,
        code: formData.code,
        admin_password: formData.admin_password ? '***' : 'MISSING',
        logo_url: uploadedLogoUrl ? 'set' : 'not set'
      })

      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name: formData.name,
          short_name: formData.short_name || null,
          code: formData.code,
          tagline: formData.tagline || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          primary_color: formData.primary_color,
          admin_password: formData.admin_password,
          logo_url: uploadedLogoUrl,
          is_active: true,
        })
        .select()
        .single()

      if (schoolError) {
        console.error('[v0] School creation error:', schoolError)
        throw new Error(schoolError.message)
      }

      console.log('[v0] School created successfully:', school.id)

      // Create selected classes (including custom ones and streams)
      const standardClasses = ALL_CLASSES.filter(c => selectedClasses.includes(c.name))
      const customClasses = selectedClasses.filter(c => !ALL_CLASSES.find(ac => ac.name === c))
      
      const classesToInsert: { name: string; display_order: number; school_id: string; password: string }[] = []
      let orderIndex = 0
      
      // Process standard classes
      for (const c of standardClasses) {
        const streams = classStreams[c.name] || []
        if (streams.length > 0) {
          // Create a class for each stream (e.g., "Grade 5 East", "Grade 5 West")
          streams.forEach((stream, streamIdx) => {
            classesToInsert.push({
              name: `${c.name} ${stream}`,
              display_order: c.display_order * 100 + streamIdx,
              school_id: school.id,
              password: 'welcome',
            })
          })
        } else {
          // No streams, create single class
          classesToInsert.push({
            name: c.name,
            display_order: c.display_order,
            school_id: school.id,
            password: 'welcome',
          })
        }
      }
      
      // Process custom classes
      for (const name of customClasses) {
        const streams = classStreams[name] || []
        if (streams.length > 0) {
          streams.forEach((stream, streamIdx) => {
            classesToInsert.push({
              name: `${name} ${stream}`,
              display_order: ALL_CLASSES.length * 100 + orderIndex++,
              school_id: school.id,
              password: 'welcome',
            })
          })
        } else {
          classesToInsert.push({
            name,
            display_order: ALL_CLASSES.length + orderIndex++,
            school_id: school.id,
            password: 'welcome',
          })
        }
      }
      
      if (classesToInsert.length > 0) {
        console.log('[v0] Creating classes:', classesToInsert.length)
        const { error: classesError } = await supabase.from('classes').insert(classesToInsert)
        if (classesError) console.error('[v0] Classes error:', classesError)
      }

      // Copy subjects and exam types from St James
      const { data: stjamesSchool } = await supabase
        .from('schools')
        .select('id')
        .eq('code', 'stjames')
        .single()

      // Create default exam types for the new school (no subjects - those are added by teachers per class)
      const defaultExamTypes = ['Opener', 'Mid-Term', 'End-Term']
      const examTypesToInsert = defaultExamTypes.map((name, idx) => ({
        name,
        school_id: school.id,
        display_order: idx + 1,
      }))
      const { error: examTypesError } = await supabase.from('exam_types').insert(examTypesToInsert)
      if (examTypesError) console.error('[v0] Exam types error:', examTypesError)
      console.log('[v0] Created exam types:', examTypesToInsert.length)
      
      // NOTE: Subjects are NOT auto-created - teachers add subjects per class
      // NOTE: Exam sessions are NOT auto-created - created when teachers/admin set up exams

      // Create sessions for each class (sessions require class_id)
      const { data: newClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', school.id)
      
      if (newClasses && newClasses.length > 0) {
        const currentYear = new Date().getFullYear()
        const terms = ['Term 1', 'Term 2', 'Term 3']
        // Create base sessions for login (no exam_type_id - those are created by admin/teachers)
        const sessionsToInsert = newClasses.flatMap(cls => 
          terms.map(term => ({
            class_id: cls.id,
            year: currentYear,
            term: term,
            is_active: true,
            school_id: school.id,
          }))
        )
        const { error: sessionsError } = await supabase.from('sessions').insert(sessionsToInsert)
        if (sessionsError) console.error('[v0] Sessions error:', sessionsError)
        console.log('[v0] Created base sessions:', sessionsToInsert.length)
        // NOTE: Exam sessions (with exam_type_id) are created by admin when setting up exams
      }

      console.log('[v0] School setup complete!')

      // Generate the school link
      const baseUrl = window.location.origin
      const schoolLink = `${baseUrl}/?school=${formData.code}`
      setGeneratedLink(schoolLink)
      setSuccess(true)

    } catch (err: any) {
      console.error('[v0] Error creating school:', err)
      setError(err.message || 'Failed to create school. Please try again.')
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

  // Success screen
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
                <li>{selectedClasses.length} classes ({selectedClasses.slice(0, 5).join(', ')}{selectedClasses.length > 5 ? '...' : ''})</li>
                <li>All subjects (copied from St James Koteko)</li>
                <li>All exam types (copied from St James Koteko)</li>
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
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => step === 1 ? router.push('/select-school') : handleBack()}
            className="w-fit -ml-2 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {step === 1 ? 'Back to Schools' : 'Back'}
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <School className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Add New School</CardTitle>
              <CardDescription>
                Step {step} of 2: {step === 1 ? 'School Details' : 'Select Classes'}
              </CardDescription>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[1, 2].map(s => (
              <div 
                key={s} 
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Step 1: School Details */}
          {step === 1 && (
            <div className="space-y-4">
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

              {/* Logo Upload Section */}
              <div className="space-y-2">
                <Label>School Logo</Label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                  {logoPreview ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        <Image
                          src={logoPreview}
                          alt="Logo preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{logoFile?.name}</p>
                        <p className="text-xs text-gray-500">
                          {logoFile && (logoFile.size / 1024).toFixed(1)} KB
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeLogo}
                          className="text-red-500 hover:text-red-700 mt-1 -ml-2"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 cursor-pointer py-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          Click to upload logo
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          JPG, PNG, GIF or WebP (max 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                  {logoError && (
                    <p className="text-sm text-red-500 mt-2">{logoError}</p>
                  )}
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
            </div>
          )}

          {/* Step 2: Select Classes */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Select the classes for this school:</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedClasses(ALL_CLASSES.map(c => c.name))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedClasses([])}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {ALL_CLASSES.map(c => (
                  <div key={c.name} className={`rounded-lg border-2 transition-all ${
                    selectedClasses.includes(c.name)
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <button
                      type="button"
                      onClick={() => toggleClass(c.name)}
                      className={`w-full p-3 text-sm font-medium text-left flex items-center justify-between ${
                        selectedClasses.includes(c.name)
                          ? 'text-blue-700'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <span>
                        {selectedClasses.includes(c.name) && (
                          <Check className="w-4 h-4 inline mr-1" />
                        )}
                        {c.name}
                      </span>
                      {classStreams[c.name]?.length > 0 && (
                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                          {classStreams[c.name].length} streams
                        </span>
                      )}
                    </button>
                    
                    {/* Stream input - only show when class is selected */}
                    {selectedClasses.includes(c.name) && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex gap-1">
                          <Input
                            placeholder="Add stream (e.g., East, A)"
                            value={newStreamInput[c.name] || ''}
                            onChange={(e) => setNewStreamInput(prev => ({ ...prev, [c.name]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStreamToClass(c.name))}
                            className="h-8 text-xs"
                          />
                          <Button 
                            type="button"
                            onClick={() => addStreamToClass(c.name)} 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2"
                            disabled={!newStreamInput[c.name]?.trim()}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        {classStreams[c.name]?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {classStreams[c.name].map(stream => (
                              <span
                                key={stream}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs"
                              >
                                {stream}
                                <button
                                  type="button"
                                  onClick={() => removeStreamFromClass(c.name, stream)}
                                  className="hover:text-blue-900"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <hr className="my-4" />

              {/* Custom Class Input */}
              <div className="space-y-2">
                <Label>Add Custom Class</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Nursery, Pre-School, Grade 10..."
                    value={customClassName}
                    onChange={(e) => setCustomClassName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomClass()}
                  />
                  <Button onClick={addCustomClass} variant="outline" disabled={!customClassName.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Show custom classes with stream support */}
              {selectedClasses.filter(c => !ALL_CLASSES.find(ac => ac.name === c)).length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm text-gray-600">Custom Classes:</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedClasses.filter(c => !ALL_CLASSES.find(ac => ac.name === c)).map(cls => (
                      <div
                        key={cls}
                        className="rounded-lg border-2 border-green-500 bg-green-50 p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-green-700">{cls}</span>
                          <button
                            type="button"
                            onClick={() => removeCustomClass(cls)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <Input
                            placeholder="Add stream"
                            value={newStreamInput[cls] || ''}
                            onChange={(e) => setNewStreamInput(prev => ({ ...prev, [cls]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStreamToClass(cls))}
                            className="h-8 text-xs"
                          />
                          <Button 
                            type="button"
                            onClick={() => addStreamToClass(cls)} 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2"
                            disabled={!newStreamInput[cls]?.trim()}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        {classStreams[cls]?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {classStreams[cls].map(stream => (
                              <span
                                key={stream}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs"
                              >
                                {stream}
                                <button
                                  type="button"
                                  onClick={() => removeStreamFromClass(cls, stream)}
                                  className="hover:text-green-900"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 space-y-1">
                <p>{selectedClasses.length} classes selected</p>
                {Object.values(classStreams).some(s => s.length > 0) && (
                  <p className="text-blue-600">
                    + {Object.values(classStreams).reduce((total, streams) => total + Math.max(0, streams.length - 1), 0)} additional stream classes
                  </p>
                )}
                <p className="text-xs text-gray-400">Default class password: welcome</p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-4">
            {step === 1 ? (
              <Button onClick={handleNext} className="flex-1" size="lg">
                Next: Select Classes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreateSchool} 
                className="flex-1"
                disabled={isLoading || selectedClasses.length === 0}
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
