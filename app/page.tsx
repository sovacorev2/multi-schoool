'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { checkTeacherAuth } from '@/app/actions/auth'
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
import { LogIn } from 'lucide-react'
import type { Class, ExamType, Session } from '@/lib/types'
import { schoolConfig } from '@/lib/school-config'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1]
const TERMS = ['Term 1', 'Term 2', 'Term 3']

export default function HomePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR.toString())
  const [selectedTerm, setSelectedTerm] = useState('Term 1')
  const [selectedExamType, setSelectedExamType] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(true)
  const [error, setError] = useState('')
  
  const router = useRouter()
  const { setCurrentClass, setCurrentSession, currentClass, currentSession } = useClass()

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        
        const [classesRes, examTypesRes] = await Promise.all([
          supabase.from('classes').select('*').order('display_order'),
          supabase.from('exam_types').select('*').order('name'),
        ])

        if (classesRes.error) {
          console.error('[v0] Classes fetch error:', classesRes.error)
        }
        if (examTypesRes.error) {
          console.error('[v0] Exam types fetch error:', examTypesRes.error)
        }

        if (classesRes.data) setClasses(classesRes.data)
        if (examTypesRes.data) setExamTypes(examTypesRes.data)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        if (errorMessage.includes('environment variables')) {
          setError('Database connection not configured. Please contact the administrator.')
        } else {
          setError('Failed to load data. Please try again.')
        }
        console.error('[v0] Fetch error:', err)
      } finally {
        setIsFetchingData(false)
      }
    }

    fetchData()
  }, [])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2">{schoolConfig.name}</CardTitle>
            <CardDescription className="text-base text-gray-600">Exam Marks Entry System</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
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
