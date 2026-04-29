'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, ArrowRight, Check, School, Users, BookOpen, Layers, Link2, Loader2 } from 'lucide-react'

// Default classes configuration
const DEFAULT_CLASSES = [
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

// Default subjects configuration
const DEFAULT_SUBJECTS = [
  { name: 'Mathematics', code: 'MAT' },
  { name: 'English', code: 'ENG' },
  { name: 'Kiswahili', code: 'KIS' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SST' },
  { name: 'CRE', code: 'CRE' },
  { name: 'IRE', code: 'IRE' },
  { name: 'Creative Arts', code: 'CRA' },
  { name: 'Agriculture', code: 'AGR' },
  { name: 'Home Science', code: 'HSC' },
  { name: 'Physical Education', code: 'PHE' },
  { name: 'Pre-Technical Studies', code: 'PTS' },
  { name: 'Integrated Science', code: 'INT' },
]

// Default exam types
const DEFAULT_EXAM_TYPES = [
  { name: 'Opener' },
  { name: 'Mid-Term' },
  { name: 'End-Term' },
]

// Default streams
const DEFAULT_STREAMS = [
  { name: 'East' },
  { name: 'West' },
  { name: 'North' },
  { name: 'South' },
]

type Step = 'credentials' | 'classes' | 'streams' | 'subjects' | 'exam_types' | 'review'

export default function SetupSchoolPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('credentials')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')

  // School credentials
  const [schoolData, setSchoolData] = useState({
    name: '',
    short_name: '',
    code: '',
    tagline: '',
    email: '',
    phone: '',
    address: '',
    primary_color: '#2563eb',
    admin_password: '',
  })

  // Selected classes
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    DEFAULT_CLASSES.map(c => c.name)
  )

  // Custom streams
  const [streams, setStreams] = useState<string[]>([''])
  const [useStreams, setUseStreams] = useState(false)

  // Selected subjects
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    DEFAULT_SUBJECTS.map(s => s.name)
  )

  // Selected exam types
  const [selectedExamTypes, setSelectedExamTypes] = useState<string[]>(
    DEFAULT_EXAM_TYPES.map(e => e.name)
  )
  const [customExamTypes, setCustomExamTypes] = useState<string[]>([])

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'credentials', label: 'School Info', icon: <School className="w-4 h-4" /> },
    { id: 'classes', label: 'Classes', icon: <Users className="w-4 h-4" /> },
    { id: 'streams', label: 'Streams', icon: <Layers className="w-4 h-4" /> },
    { id: 'subjects', label: 'Subjects', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'exam_types', label: 'Exam Types', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'review', label: 'Review & Create', icon: <Check className="w-4 h-4" /> },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  const generateCode = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
  }

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const supabase = createClient()

      // 1. Create the school
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name: schoolData.name,
          short_name: schoolData.short_name,
          code: schoolData.code || generateCode(schoolData.name),
          tagline: schoolData.tagline,
          email: schoolData.email,
          phone: schoolData.phone,
          address: schoolData.address,
          primary_color: schoolData.primary_color,
          admin_password: schoolData.admin_password,
        })
        .select()
        .single()

      if (schoolError) throw schoolError

      const schoolId = school.id

      // 2. Create classes
      const classesToCreate = DEFAULT_CLASSES
        .filter(c => selectedClasses.includes(c.name))
        .map(c => ({
          name: c.name,
          display_order: c.display_order,
          school_id: schoolId,
        }))

      if (classesToCreate.length > 0) {
        const { error: classError } = await supabase
          .from('classes')
          .insert(classesToCreate)

        if (classError) throw classError
      }

      // 3. Create streams (if enabled)
      if (useStreams) {
        const streamsToCreate = streams
          .filter(s => s.trim() !== '')
          .map(s => ({
            name: s.trim(),
            school_id: schoolId,
          }))

        if (streamsToCreate.length > 0) {
          const { error: streamError } = await supabase
            .from('streams')
            .insert(streamsToCreate)

          if (streamError) throw streamError
        }
      }

      // 4. Create subjects
      const subjectsToCreate = DEFAULT_SUBJECTS
        .filter(s => selectedSubjects.includes(s.name))
        .map(s => ({
          name: s.name,
          code: s.code,
          school_id: schoolId,
        }))

      if (subjectsToCreate.length > 0) {
        const { error: subjectError } = await supabase
          .from('subjects')
          .insert(subjectsToCreate)

        if (subjectError) throw subjectError
      }

      // 5. Create exam types
      const allExamTypes = [
        ...DEFAULT_EXAM_TYPES.filter(e => selectedExamTypes.includes(e.name)),
        ...customExamTypes.filter(e => e.trim() !== '').map(name => ({ name })),
      ]

      const examTypesToCreate = allExamTypes.map(e => ({
        name: e.name,
        school_id: schoolId,
      }))

      if (examTypesToCreate.length > 0) {
        const { error: examError } = await supabase
          .from('exam_types')
          .insert(examTypesToCreate)

        if (examError) throw examError
      }

      // Generate the school link
      const baseUrl = window.location.origin
      const schoolLink = `${baseUrl}/?school=${school.code}`
      setGeneratedLink(schoolLink)

      // Move to success state
      setCurrentStep('review')
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create school'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addStream = () => {
    setStreams([...streams, ''])
  }

  const updateStream = (index: number, value: string) => {
    const newStreams = [...streams]
    newStreams[index] = value
    setStreams(newStreams)
  }

  const removeStream = (index: number) => {
    setStreams(streams.filter((_, i) => i !== index))
  }

  const addCustomExamType = () => {
    setCustomExamTypes([...customExamTypes, ''])
  }

  const updateCustomExamType = (index: number, value: string) => {
    const newTypes = [...customExamTypes]
    newTypes[index] = value
    setCustomExamTypes(newTypes)
  }

  const removeCustomExamType = (index: number) => {
    setCustomExamTypes(customExamTypes.filter((_, i) => i !== index))
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push('/select-school')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Schools
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Set Up New School</h1>
          <p className="text-gray-600 mt-2">Configure everything your school needs to get started</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step.icon}
              </div>
              <span className={`ml-2 text-sm font-medium hidden sm:block ${
                index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 ${
                  index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <Card className="shadow-lg">
          <CardContent className="p-6">
            {/* Step 1: School Credentials */}
            {currentStep === 'credentials' && (
              <div className="space-y-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>School Information</CardTitle>
                  <CardDescription>Enter your school&apos;s basic details</CardDescription>
                </CardHeader>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">School Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., St Mary's Academy"
                      value={schoolData.name}
                      onChange={(e) => setSchoolData({ ...schoolData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="short_name">Short Name</Label>
                      <Input
                        id="short_name"
                        placeholder="e.g., SMA"
                        value={schoolData.short_name}
                        onChange={(e) => setSchoolData({ ...schoolData, short_name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="code">School Code (for URL)</Label>
                      <Input
                        id="code"
                        placeholder="e.g., stmarys"
                        value={schoolData.code}
                        onChange={(e) => setSchoolData({ ...schoolData, code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                      />
                      <p className="text-xs text-gray-500">Letters and numbers only, no spaces</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tagline">School Motto/Tagline</Label>
                    <Input
                      id="tagline"
                      placeholder="e.g., Excellence in Education"
                      value={schoolData.tagline}
                      onChange={(e) => setSchoolData({ ...schoolData, tagline: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="info@school.com"
                        value={schoolData.email}
                        onChange={(e) => setSchoolData({ ...schoolData, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        placeholder="+254 700 000 000"
                        value={schoolData.phone}
                        onChange={(e) => setSchoolData({ ...schoolData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      placeholder="School address..."
                      value={schoolData.address}
                      onChange={(e) => setSchoolData({ ...schoolData, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="primary_color">Brand Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary_color"
                          type="color"
                          className="w-12 h-10 p-1 cursor-pointer"
                          value={schoolData.primary_color}
                          onChange={(e) => setSchoolData({ ...schoolData, primary_color: e.target.value })}
                        />
                        <Input
                          value={schoolData.primary_color}
                          onChange={(e) => setSchoolData({ ...schoolData, primary_color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin_password">Admin Password *</Label>
                      <Input
                        id="admin_password"
                        type="password"
                        placeholder="Secure password"
                        value={schoolData.admin_password}
                        onChange={(e) => setSchoolData({ ...schoolData, admin_password: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Classes */}
            {currentStep === 'classes' && (
              <div className="space-y-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Select Classes</CardTitle>
                  <CardDescription>Choose which classes your school will have</CardDescription>
                </CardHeader>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DEFAULT_CLASSES.map((cls) => (
                    <label
                      key={cls.name}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedClasses.includes(cls.name)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedClasses.includes(cls.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedClasses([...selectedClasses, cls.name])
                          } else {
                            setSelectedClasses(selectedClasses.filter(c => c !== cls.name))
                          }
                        }}
                      />
                      <span className="ml-2 font-medium">{cls.name}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedClasses(DEFAULT_CLASSES.map(c => c.name))}
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
            )}

            {/* Step 3: Streams */}
            {currentStep === 'streams' && (
              <div className="space-y-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Configure Streams</CardTitle>
                  <CardDescription>Add streams if your school divides classes into sections</CardDescription>
                </CardHeader>

                <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                  <Checkbox
                    id="use-streams"
                    checked={useStreams}
                    onCheckedChange={(checked) => setUseStreams(checked === true)}
                  />
                  <Label htmlFor="use-streams" className="cursor-pointer">
                    My school uses streams (e.g., Grade 1 East, Grade 1 West)
                  </Label>
                </div>

                {useStreams && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {DEFAULT_STREAMS.map((stream) => (
                        <Button
                          key={stream.name}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!streams.includes(stream.name)) {
                              setStreams([...streams.filter(s => s !== ''), stream.name])
                            }
                          }}
                        >
                          + {stream.name}
                        </Button>
                      ))}
                    </div>

                    {streams.map((stream, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Stream name (e.g., East)"
                          value={stream}
                          onChange={(e) => updateStream(index, e.target.value)}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeStream(index)}
                          disabled={streams.length === 1}
                        >
                          &times;
                        </Button>
                      </div>
                    ))}

                    <Button variant="outline" onClick={addStream}>
                      + Add Stream
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Subjects */}
            {currentStep === 'subjects' && (
              <div className="space-y-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Select Subjects</CardTitle>
                  <CardDescription>Choose the subjects taught at your school</CardDescription>
                </CardHeader>

                <div className="grid grid-cols-2 gap-3">
                  {DEFAULT_SUBJECTS.map((subject) => (
                    <label
                      key={subject.name}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedSubjects.includes(subject.name)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedSubjects.includes(subject.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSubjects([...selectedSubjects, subject.name])
                          } else {
                            setSelectedSubjects(selectedSubjects.filter(s => s !== subject.name))
                          }
                        }}
                      />
                      <span className="ml-2">{subject.name}</span>
                      <span className="ml-auto text-xs text-gray-500">{subject.code}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSubjects(DEFAULT_SUBJECTS.map(s => s.name))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSubjects([])}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Exam Types */}
            {currentStep === 'exam_types' && (
              <div className="space-y-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Configure Exam Types</CardTitle>
                  <CardDescription>Select or add the types of exams your school uses</CardDescription>
                </CardHeader>

                <div className="grid grid-cols-3 gap-3">
                  {DEFAULT_EXAM_TYPES.map((examType) => (
                    <label
                      key={examType.name}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedExamTypes.includes(examType.name)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedExamTypes.includes(examType.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedExamTypes([...selectedExamTypes, examType.name])
                          } else {
                            setSelectedExamTypes(selectedExamTypes.filter(e => e !== examType.name))
                          }
                        }}
                      />
                      <span className="ml-2">{examType.name}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-4">
                  <Label>Custom Exam Types</Label>
                  {customExamTypes.map((examType, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Exam type name"
                        value={examType}
                        onChange={(e) => updateCustomExamType(index, e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeCustomExamType(index)}
                      >
                        &times;
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addCustomExamType}>
                    + Add Custom Exam Type
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {currentStep === 'review' && (
              <div className="space-y-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>{generatedLink ? 'School Created Successfully!' : 'Review & Create'}</CardTitle>
                  <CardDescription>
                    {generatedLink 
                      ? 'Your school is ready to use. Share the link below with your staff.'
                      : 'Review your configuration before creating the school'
                    }
                  </CardDescription>
                </CardHeader>

                {generatedLink ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                        <Check className="w-5 h-5" />
                        School created successfully!
                      </div>
                      <p className="text-green-600 text-sm">
                        Your school has been set up with all the configured classes, subjects, and exam types.
                      </p>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label className="flex items-center gap-2 mb-2">
                        <Link2 className="w-4 h-4" />
                        School Access Link
                      </Label>
                      <div className="flex gap-2">
                        <Input value={generatedLink} readOnly className="bg-white" />
                        <Button onClick={copyLink}>Copy</Button>
                      </div>
                      <p className="text-sm text-blue-600 mt-2">
                        Share this link with your school administrators and teachers.
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <Button onClick={() => router.push('/select-school')} className="flex-1">
                        Go to School Selection
                      </Button>
                      <Button variant="outline" onClick={() => window.open(generatedLink, '_blank')}>
                        Open School Portal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold mb-2">School Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-gray-500">Name:</span>
                          <span>{schoolData.name || '-'}</span>
                          <span className="text-gray-500">Code:</span>
                          <span>{schoolData.code || generateCode(schoolData.name) || '-'}</span>
                          <span className="text-gray-500">Tagline:</span>
                          <span>{schoolData.tagline || '-'}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold mb-2">Classes ({selectedClasses.length})</h4>
                        <p className="text-sm text-gray-600">{selectedClasses.join(', ') || 'None selected'}</p>
                      </div>

                      {useStreams && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-semibold mb-2">Streams ({streams.filter(s => s).length})</h4>
                          <p className="text-sm text-gray-600">{streams.filter(s => s).join(', ') || 'None'}</p>
                        </div>
                      )}

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold mb-2">Subjects ({selectedSubjects.length})</h4>
                        <p className="text-sm text-gray-600">{selectedSubjects.join(', ') || 'None selected'}</p>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold mb-2">Exam Types ({selectedExamTypes.length + customExamTypes.filter(e => e).length})</h4>
                        <p className="text-sm text-gray-600">
                          {[...selectedExamTypes, ...customExamTypes.filter(e => e)].join(', ') || 'None selected'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            {!generatedLink && (
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStepIndex === 0}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                {currentStep === 'review' ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !schoolData.name || !schoolData.admin_password}
                  >
                    {isSubmitting ? (
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
                ) : (
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
