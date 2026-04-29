'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Check, School, Loader2, Copy, ExternalLink, Plus, X } from 'lucide-react'

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

// Default exam types
const DEFAULT_EXAM_TYPES = ['Opener', 'Mid-Term', 'End-Term']

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

  // Exam types selection
  const [selectedExamTypes, setSelectedExamTypes] = useState<string[]>([...DEFAULT_EXAM_TYPES])
  const [customExamType, setCustomExamType] = useState('')

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

  const toggleExamType = (examType: string) => {
    setSelectedExamTypes(prev => 
      prev.includes(examType)
        ? prev.filter(e => e !== examType)
        : [...prev, examType]
    )
  }

  const addCustomExamType = () => {
    const trimmed = customExamType.trim()
    if (trimmed && !selectedExamTypes.includes(trimmed)) {
      setSelectedExamTypes(prev => [...prev, trimmed])
      setCustomExamType('')
    }
  }

  const removeExamType = (examType: string) => {
    setSelectedExamTypes(prev => prev.filter(e => e !== examType))
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

  const validateStep3 = () => {
    if (selectedExamTypes.length === 0) return 'Select at least one exam type'
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
    } else if (step === 3) {
      const err = validateStep3()
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

      // Create selected classes
      const classesToInsert = ALL_CLASSES
        .filter(c => selectedClasses.includes(c.name))
        .map(c => ({
          name: c.name,
          display_order: c.display_order,
          school_id: school.id,
        }))
      
      if (classesToInsert.length > 0) {
        await supabase.from('classes').insert(classesToInsert)
      }

      // Create selected exam types
      const examTypesToInsert = selectedExamTypes.map(name => ({
        name,
        school_id: school.id,
      }))
      
      if (examTypesToInsert.length > 0) {
        await supabase.from('exam_types').insert(examTypesToInsert)
      }

      // Copy subjects from St James or use defaults
      const { data: stjamesSchool } = await supabase
        .from('schools')
        .select('id')
        .eq('code', 'stjames')
        .single()

      if (stjamesSchool) {
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
        } else {
          // Use defaults
          const subjectsToInsert = DEFAULT_SUBJECTS.map(s => ({
            ...s,
            school_id: school.id,
          }))
          await supabase.from('subjects').insert(subjectsToInsert)
        }
      } else {
        // Use defaults
        const subjectsToInsert = DEFAULT_SUBJECTS.map(s => ({
          ...s,
          school_id: school.id,
        }))
        await supabase.from('subjects').insert(subjectsToInsert)
      }

      // Generate the school link
      const baseUrl = window.location.origin
      const schoolLink = `${baseUrl}/?school=${formData.code}`
      setGeneratedLink(schoolLink)
      setSuccess(true)

    } catch (err) {
      console.error('[v0] Error creating school:', err)
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
                <li>{selectedClasses.length} classes ({selectedClasses.join(', ')})</li>
                <li>{selectedExamTypes.length} exam types ({selectedExamTypes.join(', ')})</li>
                <li>All subjects (same as St James Koteko)</li>
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
                Step {step} of 3: {step === 1 ? 'School Details' : step === 2 ? 'Select Classes' : 'Exam Types'}
              </CardDescription>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map(s => (
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
              
              <div className="grid grid-cols-3 gap-2">
                {ALL_CLASSES.map(c => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggleClass(c.name)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedClasses.includes(c.name)
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {selectedClasses.includes(c.name) && (
                      <Check className="w-4 h-4 inline mr-1" />
                    )}
                    {c.name}
                  </button>
                ))}
              </div>
              
              <p className="text-sm text-gray-500">
                {selectedClasses.length} classes selected
              </p>
            </div>
          )}

          {/* Step 3: Exam Types */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Select exam types for this school:</p>
              
              <div className="flex flex-wrap gap-2">
                {DEFAULT_EXAM_TYPES.map(et => (
                  <button
                    key={et}
                    type="button"
                    onClick={() => toggleExamType(et)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedExamTypes.includes(et)
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {selectedExamTypes.includes(et) && (
                      <Check className="w-4 h-4 inline mr-1" />
                    )}
                    {et}
                  </button>
                ))}
              </div>

              <hr className="my-4" />
              
              <div className="space-y-2">
                <Label>Add Custom Exam Type</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., CAT 1, Weekly Test..."
                    value={customExamType}
                    onChange={(e) => setCustomExamType(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomExamType()}
                  />
                  <Button onClick={addCustomExamType} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Show all selected exam types */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Selected Exam Types:</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedExamTypes.map(et => (
                    <span
                      key={et}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {et}
                      <button
                        type="button"
                        onClick={() => removeExamType(et)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-4">
            {step < 3 ? (
              <Button onClick={handleNext} className="flex-1" size="lg">
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreateSchool} 
                className="flex-1"
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
