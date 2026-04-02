'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { verifyAdminPassword } from '@/app/actions/auth'
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
import { Shield, Eye, EyeOff } from 'lucide-react'
import type { Class, ExamType, Session } from '@/lib/types'
import { schoolConfig } from '@/lib/school-config'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1]
const TERMS = ['Term 1', 'Term 2', 'Term 3']

export default function AdminPortalPage() {
  // Password authentication state
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false)

  // Class/session selection state (same as login page)
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
  const { setCurrentClass, setCurrentSession } = useClass()

  // Fetch classes and exam types after password authentication
  useEffect(() => {
    if (isPasswordAuthenticated) {
      async function fetchData() {
        try {
          const supabase = createClient()
          
          const [classesRes, examTypesRes] = await Promise.all([
            supabase.from('classes').select('*').order('display_order'),
            supabase.from('exam_types').select('*').order('name'),
          ])

          if (classesRes.data) setClasses(classesRes.data)
          if (examTypesRes.data) setExamTypes(examTypesRes.data)
        } catch (err) {
          setError('Failed to load data. Please check your Supabase configuration.')
          console.error('[v0] Fetch error:', err)
        } finally {
          setIsFetchingData(false)
        }
      }

      fetchData()
    }
  }, [isPasswordAuthenticated])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setIsAuthenticating(true)

    try {
      const result = await verifyAdminPassword(password)
      if (result.success) {
        setIsPasswordAuthenticated(true)
      } else {
        setPasswordError(result.error || 'Incorrect password')
      }
    } catch {
      setPasswordError('An error occurred. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

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

  // Password entry screen
  if (!isPasswordAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold mb-2">Admin Portal</CardTitle>
              <CardDescription className="text-base text-gray-600">{schoolConfig.name} - Restricted Access</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Admin Password *</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isAuthenticating || !password}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                {isAuthenticating ? 'Verifying...' : 'Login as Admin'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
              >
                Back to Main Portal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Class/exam selection screen (identical to login page)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2">{schoolConfig.name}</CardTitle>
            <CardDescription className="text-base text-gray-600">Admin Dashboard - Select Class</CardDescription>
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
                className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
              >
                {isLoading ? 'Loading...' : 'Access Admin Dashboard'}
              </Button>

              <Button
                onClick={() => {
                  setIsPasswordAuthenticated(false)
                  setPassword('')
                  setPasswordError('')
                  setSelectedClass('')
                  setSelectedExamType('')
                }}
                variant="outline"
                className="w-full"
              >
                Logout
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
