'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sortClassesByLevel } from '@/lib/class-sort-utils'
import { useClass } from '@/lib/class-context'
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

export default function LoginPage() {
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
    if (currentClass && currentSession) {
      router.push('/dashboard')
    }
  }, [currentClass, currentSession, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        
        const [classesRes, examTypesRes] = await Promise.all([
          supabase.from('classes').select('id, name, school_id, display_order').order('display_order'),
          supabase.from('exam_types').select('id, name, display_order, school_id').order('name'),
        ])

        if (classesRes.data) setClasses(sortClassesByLevel(classesRes.data))
        if (examTypesRes.data) setExamTypes(examTypesRes.data)
      } catch (err) {
        setError('Failed to load data. Please check your Supabase configuration.')
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
        return
      }

      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, exam_types(*)')
        .eq('class_id', selectedClass)
        .eq('exam_type_id', selectedExamType)
        .eq('term', selectedTerm)
        .eq('year', parseInt(selectedYear))

      if (sessionsError) throw sessionsError

      let session: Session
      if (sessions && sessions.length > 0) {
        session = sessions[0]
      } else {
        const { data: newSession, error: createError } = await supabase
          .from('sessions')
          .insert({
            class_id: selectedClass,
            exam_type_id: selectedExamType,
            term: selectedTerm,
            year: parseInt(selectedYear),
            is_locked: false,
          })
          .select('*, exam_types(*)')
          .single()

        if (createError) throw createError
        session = newSession
      }

      setCurrentClass(selectedClassObj)
      setCurrentSession(session)
      router.push('/dashboard')
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

          {isFetchingData ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
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
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
