'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function TeacherPINLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [pin, setPin] = useState('')
  const [schoolCode, setSchoolCode] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schoolLoading, setSchoolLoading] = useState(true)

  // Get school from URL parameter and fetch school details
  useEffect(() => {
    const school = searchParams.get('school')
    if (!school) {
      setError('No school specified. Please use the school selection page.')
      setSchoolLoading(false)
      return
    }

    setSchoolCode(school)
    fetchSchoolDetails(school)
  }, [searchParams])

  async function fetchSchoolDetails(code: string) {
    try {
      setSchoolLoading(true)
      // Get school ID and name from the school code
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, code')
        .eq('code', code)
        .eq('feature_pin_management', true)
        .single()

      if (error || !data) {
        throw new Error('School not found or PIN login not enabled for this school.')
      }

      setSchoolId(data.id)
      setSchoolName(data.name)
    } catch (err) {
      console.error('[v0] Error fetching school details:', err)
      setError(err instanceof Error ? err.message : 'Could not load school information. Please try again.')
    } finally {
      setSchoolLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate input
      if (!pin.trim() || pin.length !== 4) {
        throw new Error('Please enter your 4-digit PIN')
      }
      if (!schoolId) {
        throw new Error('School information not available. Please refresh and try again.')
      }

      // Verify PIN and get teacher details
      const { data: teacher, error: teacherError } = await supabase
        .from('teacher_accounts')
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          school_id,
          is_active,
          teacher_assignments(
            id,
            class_id,
            subject_id,
            classes:class_id(id, name),
            subjects:subject_id(id, name)
          )
        `,
        )
        .eq('pin', pin)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .single()

      if (teacherError || !teacher) {
        throw new Error('Invalid PIN or teacher not found. Please check and try again.')
      }

      // Store session in localStorage
      const session = {
        teacherId: teacher.id,
        name: `${teacher.first_name} ${teacher.last_name}`,
        email: teacher.email,
        schoolId: schoolId,
        schoolName: schoolName,
        pin: pin,
        assignments: teacher.teacher_assignments || [],
        loginTime: new Date().toISOString(),
      }

      localStorage.setItem('teacher_session', JSON.stringify(session))
      localStorage.setItem('teacher_pin', pin)

      // Redirect to teacher dashboard
      router.push('/teacher/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
      console.error('[v0] Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-6 h-6" />
            <CardTitle>Teacher Portal Login</CardTitle>
          </div>
          <CardDescription className="text-blue-100">ShuleTech Examination System</CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {schoolLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading school information...</p>
            </div>
          ) : !schoolId ? (
            <div className="text-center py-8">
              <p className="text-red-600">Unable to load school. Please go back and try again.</p>
            </div>
          ) : (
            <>
              {/* School Info Display */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Logging in to:</p>
                <p className="text-lg font-semibold text-blue-900">{schoolName}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* PIN Input */}
                <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your 4-Digit PIN *
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  inputMode="numeric"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl letter-spacing font-mono"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-900"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Check your email for your PIN</p>
            </div>

                {/* Submit Button */}
                <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
              </form>

              {/* Help Text */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How to login:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>✓ Enter your 4-digit PIN</li>
                  <li>✓ Access all your assigned classes directly</li>
                  <li>✓ Marks autosave as you enter them</li>
                </ul>
              </div>
            </>
          )}

          {/* Forgot PIN */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600">
              Forgot your PIN?{' '}
              <a href="#" className="text-blue-600 hover:underline">
                Contact your school administrator
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
