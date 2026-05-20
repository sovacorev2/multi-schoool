"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { verifyAdminPassword } from "@/app/actions/auth"
import { createClient } from "@/lib/supabase/client"
import { sortClassesByLevel } from "@/lib/class-sort-utils"
import { useClass } from "@/lib/class-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, Eye, EyeOff } from "lucide-react"
import type { Class, ExamType } from "@/lib/types"
import { schoolConfig } from "@/lib/school-config"

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = ['Term 1', 'Term 2', 'Term 3']

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Class selection for after login
  const [classes, setClasses] = useState<Class[]>([])
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR.toString())
  const [selectedTerm, setSelectedTerm] = useState("Term 1")
  const [selectedExamType, setSelectedExamType] = useState("")
  const [isFetchingData, setIsFetchingData] = useState(false)
  
  const router = useRouter()
  const { setCurrentClass, setCurrentSession } = useClass()

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch classes and exam types after login
      async function fetchData() {
        setIsFetchingData(true)
        try {
          const supabase = createClient()
          const [classesRes, examTypesRes] = await Promise.all([
            supabase.from('classes').select('*').order('display_order'),
            supabase.from('exam_types').select('*').order('name'),
          ])
          if (classesRes.data) setClasses(sortClassesByLevel(classesRes.data))
          if (examTypesRes.data) setExamTypes(examTypesRes.data)
        } catch (err) {
          console.error('[v0] Error fetching data:', err)
        } finally {
          setIsFetchingData(false)
        }
      }
      fetchData()
    }
  }, [isAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await verifyAdminPassword(password)
      if (result.success) {
        setIsAuthenticated(true)
      } else {
        setError(result.error || "Incorrect password")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleProceed = async () => {
    if (!selectedClass || !selectedExamType) {
      setError("Please select a class and exam type")
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const selectedClassObj = classes.find((c) => c.id === selectedClass)

      if (!selectedClassObj) {
        setError("Invalid class selected")
        setIsLoading(false)
        return
      }

      // Check if session exists or create it
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, exam_types(*)')
        .eq('class_id', selectedClass)
        .eq('exam_type_id', selectedExamType)
        .eq('term', selectedTerm)
        .eq('year', parseInt(selectedYear))

      if (sessionsError) throw sessionsError

      let session
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
      router.push('/dashboard/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to proceed")
    } finally {
      setIsLoading(false)
    }
  }

  // Show class selection after authentication
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-gray-700 bg-gray-800">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold mb-2 text-white">Welcome Admin</CardTitle>
              <CardDescription className="text-base text-gray-400">
                Select a class and session to manage
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {isFetchingData ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Select Class</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="-- Choose a class --" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id} className="text-white hover:bg-gray-600">
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Year</label>
                    <Input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Term</label>
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        {TERMS.map((term) => (
                          <SelectItem key={term} value={term} className="text-white hover:bg-gray-600">
                            {term}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Exam Type</label>
                  <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="-- Choose exam type --" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {examTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id} className="text-white hover:bg-gray-600">
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleProceed}
                  disabled={isLoading || !selectedClass || !selectedExamType}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg"
                >
                  {isLoading ? "Loading..." : "Proceed to Dashboard"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-gray-700 bg-gray-800">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2 text-white">Admin Login</CardTitle>
<CardDescription className="text-base text-gray-400">
                {schoolConfig.name} - Exam Management System
              </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Admin Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="pr-10 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !password}
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg"
            >
              {isLoading ? "Verifying..." : "Login as Admin"}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-800 px-2 text-gray-400">Or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
            >
              Go to Teacher Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
