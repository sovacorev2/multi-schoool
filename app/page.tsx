'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { isNetworkError, getFallbackData, cacheFallbackData } from '@/lib/fallback-data'
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
import { LogIn, AlertCircle } from 'lucide-react'
import type { Class, ExamType } from '@/lib/types'

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = ['Term 1', 'Term 2', 'Term 3']

// Helper to sort classes: PP1, PP2, then Grade 1, 2, 3... with streams alphabetically
function sortClasses(classes: Class[]): Class[] {
  const getClassOrder = (name: string) => {
    // Extract base class and stream (e.g., "Grade 5 RED" -> "Grade 5", "RED")
    const match = name.match(/^(PP\s*\d+|Grade\s+\d+|Form\s+\d+)(?:\s+(.+))?$/i)
    if (!match) return { order: 999, streamOrder: name }
    
    const baseName = match[1].toUpperCase().replace(/\s+/g, '')
    const stream = match[2] || ''
    
    // PP classes come first (PP1=1, PP2=2)
    if (baseName.startsWith('PP')) {
      const num = parseInt(baseName.replace('PP', '')) || 0
      return { order: num, streamOrder: stream }
    }
    
    // Grade classes (Grade 1=11, Grade 2=12, etc.)
    if (baseName.includes('GRADE')) {
      const num = parseInt(baseName.replace(/GRADE/i, '')) || 0
      return { order: 10 + num, streamOrder: stream }
    }
    
    // Form classes (Form 1=101, Form 2=102, etc.)
    if (baseName.includes('FORM')) {
      const num = parseInt(baseName.replace(/FORM/i, '')) || 0
      return { order: 100 + num, streamOrder: stream }
    }
    
    return { order: 999, streamOrder: name }
  }
  
  return [...classes].sort((a, b) => {
    const orderA = getClassOrder(a.name)
    const orderB = getClassOrder(b.name)
    
    // First sort by class order (PP1, PP2, Grade 1, etc.)
    if (orderA.order !== orderB.order) {
      return orderA.order - orderB.order
    }
    
    // Then sort streams alphabetically (A, B, East, West)
    return orderA.streamOrder.localeCompare(orderB.streamOrder)
  })
}

function HomePageContent() {
  const [classes, setClasses] = useState<Class[]>([])
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedBaseClass, setSelectedBaseClass] = useState('')
  const [selectedStream, setSelectedStream] = useState('')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR.toString())
  const [selectedTerm, setSelectedTerm] = useState('Term 1')
  const [selectedExamType, setSelectedExamType] = useState('')
  
  // Group classes by base class (e.g., "Grade 5" groups "Grade 5 A", "Grade 5 B")
  const getClassGroups = () => {
    const groups: { [key: string]: Class[] } = {}
    const standalone: Class[] = []
    
    sortClasses(classes).forEach(cls => {
      // Check if this class has a stream suffix (e.g., "Grade 5 RED", "PP1 East")
      const match = cls.name.match(/^(PP\s*\d+|Grade\s+\d+|Form\s+\d+)\s+(.+)$/i)
      if (match) {
        const baseClass = match[1].replace(/\s+/g, ' ').trim() // Normalize spacing
        if (!groups[baseClass]) groups[baseClass] = []
        groups[baseClass].push(cls)
      } else {
        standalone.push(cls)
      }
    })
    
    return { groups, standalone }
  }
  
  const { groups: classGroups, standalone: standaloneClasses } = getClassGroups()
  const hasStreams = Object.keys(classGroups).length > 0
  
  // Get streams for selected base class
  const availableStreams = selectedBaseClass ? (classGroups[selectedBaseClass] || []) : []
  
  // Update selectedClass when base class or stream changes
  useEffect(() => {
    if (hasStreams && selectedBaseClass) {
      // Handle standalone classes (prefixed with standalone_)
      if (selectedBaseClass.startsWith('standalone_')) {
        const classId = selectedBaseClass.replace('standalone_', '')
        setSelectedClass(classId)
        setSelectedStream('')
      } else if (availableStreams.length > 0) {
        if (selectedStream) {
          const found = availableStreams.find(c => c.id === selectedStream)
          if (found) setSelectedClass(found.id)
        } else if (availableStreams.length === 1) {
          // Auto-select if only one stream
          setSelectedClass(availableStreams[0].id)
          setSelectedStream(availableStreams[0].id)
        }
      }
    }
  }, [selectedBaseClass, selectedStream, availableStreams, hasStreams])
  
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(true)
  const [error, setError] = useState('')
  const [isUsingFallback, setIsUsingFallback] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setCurrentClass, logout: logoutClass } = useClass()
  const { currentSchool, setCurrentSchool, clearSchool } = useSchool()

  // Check for school code in URL - REQUIRED to access any school
  useEffect(() => {
    const schoolCode = searchParams.get('school')
    
    // No school code in URL - check if we have a stored school
    if (!schoolCode) {
      if (currentSchool?.code) {
        // Redirect to current school's page
        router.push(`/?school=${currentSchool.code}`)
      }
      // If no school at all, stay on page (will show error or prompt)
      return
    }
    
    // If URL has school code, check if it matches current school
    if (currentSchool && currentSchool.code === schoolCode) {
      // Already on correct school
      return
    }
    
    // Load school from URL parameter (different school or no school set)
    async function loadSchoolFromCode() {
      // Clear existing data first
      setClasses([])
      setExamTypes([])
      
      const supabase = createClient()
      const { data: school } = await supabase
        .from('schools')
        .select('*')
        .eq('code', schoolCode)
        .eq('is_active', true)
        .single()
      
      if (school) {
        // Clear class context completely when switching schools
        logoutClass()
        setCurrentSchool(school)
      }
      // If school not found, stay on page and show error
    }
    loadSchoolFromCode()
  }, [searchParams, currentSchool, setCurrentSchool, clearSchool, logoutClass, router])

  useEffect(() => {
    async function fetchData() {
      // School code in URL is REQUIRED
      const schoolCode = searchParams.get('school')
      if (!schoolCode || !currentSchool) return
      
      // Ensure URL school code matches current school
      if (currentSchool.code !== schoolCode) {
        // School is being switched, don't fetch yet
        return
      }

      try {
        const supabase = createClient()
        
        // Filter data by school_id
        const [classesRes, examTypesRes] = await Promise.all([
          supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order'),
          supabase.from('exam_types').select('*').eq('school_id', currentSchool.id).order('name'),
        ])

        if (classesRes.error) {
          console.error('[v0] Classes fetch error:', classesRes.error)
        }
        if (examTypesRes.error) {
          console.error('[v0] Exam types fetch error:', examTypesRes.error)
        }

        if (classesRes.data) {
          setClasses(classesRes.data)
          cacheFallbackData('classes', classesRes.data)
        }
        if (examTypesRes.data) {
          setExamTypes(examTypesRes.data)
          cacheFallbackData('exam_types', examTypesRes.data)
        }

        // If both are empty, try fallback
        if (!classesRes.data || classesRes.data.length === 0) {
          console.log('[v0] No data from database, using fallback')
          setClasses(getFallbackData<Class>('classes'))
          setExamTypes(getFallbackData<ExamType>('exam_types'))
          setIsUsingFallback(true)
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        
        if (isNetworkError(err)) {
          // Network error - use fallback data
          console.log('[v0] Network error, using fallback data:', errorMessage)
          setClasses(getFallbackData<Class>('classes'))
          setExamTypes(getFallbackData<ExamType>('exam_types'))
          setIsUsingFallback(true)
        } else if (errorMessage.includes('environment variables')) {
          setError('Database connection not configured. Please contact the administrator.')
        } else {
          setError('Failed to load data. Using offline data.')
          setClasses(getFallbackData<Class>('classes'))
          setExamTypes(getFallbackData<ExamType>('exam_types'))
          setIsUsingFallback(true)
        }
        console.error('[v0] Fetch error:', err)
      } finally {
        setIsFetchingData(false)
      }
    }

    fetchData()
  }, [currentSchool, searchParams])

  const handleLogin = async () => {
    setError('')
    if (!selectedClass || !selectedExamType || !selectedTerm) {
      setError('Please select class, term, and exam type')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const selectedClassObj = classes.find((c) => c.id === selectedClass)

      if (!selectedClassObj) {
        setError('Invalid class selected')
        setIsLoading(false)
        return
      }

      // Auto-create session if it doesn't exist
      try {
        // First, check if session already exists
        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('class_id', selectedClass)
          .eq('exam_type_id', selectedExamType)
          .eq('term', selectedTerm)
          .eq('year', parseInt(selectedYear))
          .single()

        // If session doesn't exist, create it
        if (!existingSession) {
          const { data: newSession, error: createError } = await supabase
            .from('sessions')
            .insert({
              class_id: selectedClass,
              school_id: currentSchool?.id,
              exam_type_id: selectedExamType,
              term: selectedTerm,
              year: parseInt(selectedYear),
              is_locked: false,
            })
            .select()
            .single()

          if (createError) {
            console.error('[v0] Error creating session:', createError)
            // Don't fail login, just log the error
          } else if (newSession) {
            console.log('[v0] Auto-created session:', newSession.id)
            // Log the action
            await supabase.from('activity_logs').insert({
              school_id: currentSchool?.id,
              action: 'session_auto_created',
              details: `Auto-created session: ${selectedExamType} - ${selectedTerm} ${selectedYear} for ${selectedClassObj.name}`,
              performed_by: selectedClassObj.name,
            })
          }
        }
      } catch (sessionError) {
        console.error('[v0] Session creation error (non-fatal):', sessionError)
        // Continue with login even if session creation fails
      }

      // Set class in context - Teachers do NOT use sessions
      // Sessions are admin-only concepts used in the admin portal
      setCurrentClass(selectedClassObj)
      // DO NOT set currentSession for teachers

      // Always require password authentication - no bypass via cookies
      const className = encodeURIComponent(selectedClassObj.name)
      router.push(`/auth/teacher?classId=${selectedClass}&className=${className}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      console.error('[v0] Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render if no school selected
  if (!currentSchool) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            <img 
              src={currentSchool.logo_url || `/logos/${currentSchool.code}.png`}
              alt={`${currentSchool.name} logo`}
              className="w-20 h-20 object-contain"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                const code = currentSchool.code || ''
                const shortCode = currentSchool.short_name?.toLowerCase().replace(/\s+/g, '-') || ''
                const nameCode = currentSchool.name.toLowerCase().replace(/\s+/g, '-')
                
                // Try different naming conventions
                if (target.src.includes(`${code}.png`)) {
                  target.src = `/logos/${code}.jpeg`
                } else if (target.src.includes(`${code}.jpeg`)) {
                  target.src = `/logos/${shortCode}.png`
                } else if (target.src.includes(`${shortCode}.png`)) {
                  target.src = `/logos/${shortCode}.jpeg`
                } else if (target.src.includes(`${shortCode}.jpeg`)) {
                  target.src = `/logos/${nameCode}.png`
                } else {
                  // All fallbacks failed, show initials
                  target.style.display = 'none'
                  const fallback = target.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }
              }}
            />
            <div 
              className="w-20 h-20 rounded-full items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: currentSchool.primary_color || '#2563eb', display: 'none' }}
            >
              {currentSchool.short_name?.substring(0, 2) || currentSchool.name.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold mb-2">{currentSchool.name}</CardTitle>
            <CardDescription className="text-base text-gray-600">Exam Marks Entry System</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {isUsingFallback && !error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Using offline data - Database connection temporarily unavailable</span>
            </div>
          )}

          {isFetchingData && !error ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : !error ? (
            <>
              {/* Class Selection - with stream grouping if applicable */}
              {hasStreams ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Select Class *</label>
                    <Select value={selectedBaseClass} onValueChange={(val) => {
                      setSelectedBaseClass(val)
                      setSelectedStream('')
                      setSelectedClass('')
                    }}>
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue placeholder="-- Choose a class --" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {/* Standalone classes first */}
                        {standaloneClasses.map((cls) => (
                          <SelectItem key={cls.id} value={`standalone_${cls.id}`}>
                            {cls.name}
                          </SelectItem>
                        ))}
                        {/* Then grouped base classes */}
                        {Object.keys(classGroups).map((baseClass) => (
                          <SelectItem key={baseClass} value={baseClass}>
                            {baseClass} ({classGroups[baseClass].length} streams)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedBaseClass && !selectedBaseClass.startsWith('standalone_') && availableStreams.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Select Stream *</label>
                      <Select value={selectedStream} onValueChange={(val) => {
                        setSelectedStream(val)
                        setSelectedClass(val)
                      }}>
                        <SelectTrigger className="bg-white text-gray-900">
                          <SelectValue placeholder="-- Choose stream --" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {availableStreams.map((cls) => {
                            const streamName = cls.name.replace(/^(PP\s*\d+|Grade\s+\d+|Form\s+\d+)\s+/i, '')
                            return (
                              <SelectItem key={cls.id} value={cls.id}>
                                {streamName}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Select Class *</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="bg-white text-gray-900">
                      <SelectValue placeholder="-- Choose a class --" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {sortClasses(classes).map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Year *</label>
                  <Input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Term *</label>
                  <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                    <SelectTrigger className="bg-white text-gray-900">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {TERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Exam Type *</label>
                <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                  <SelectTrigger className="bg-white text-gray-900">
                    <SelectValue placeholder="-- Choose exam type --" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {examTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleLogin}
                disabled={isLoading || !selectedClass || !selectedExamType}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                {isLoading ? 'Please wait...' : 'Continue'}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
}
