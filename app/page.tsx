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

function HomePageContent() {
  const [classes, setClasses] = useState<Class[]>([])
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR.toString())
  const [selectedTerm, setSelectedTerm] = useState('Term 1')
  const [selectedExamType, setSelectedExamType] = useState('')
  
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
    
    // No school code in URL = redirect to school selection
    // School code is ALWAYS required, even if there's a school in localStorage
    if (!schoolCode) {
      // Clear any stored school data and redirect
      clearSchool()
      logoutClass()
      router.push('/select-school')
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
      } else {
        router.push('/select-school')
      }
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
    if (!selectedClass || !selectedExamType) {
      setError('Please select class and exam type')
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
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Select Class *</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white text-gray-900">
                    <SelectValue placeholder="-- Choose a class --" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
