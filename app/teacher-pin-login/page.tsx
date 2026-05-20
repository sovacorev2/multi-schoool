'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function TeacherPINLogin() {
  const router = useRouter()
  const supabase = createClient()

  const [welcomePassword, setWelcomePassword] = useState('')
  const [pin, setPin] = useState('')
  const [school, setSchool] = useState('')
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schoolsLoading, setSchoolsLoading] = useState(true)

  // Fetch schools on mount
  useState(() => {
    fetchSchools()
  }, [])

  async function fetchSchools() {
    try {
      setSchoolsLoading(true)
      // Only show schools with PIN login enabled (pilot feature)
      const { data, error } = await supabase
        .from('schools')
        .select('id, name')
        .eq('feature_pin_management', true)
        .order('name')

      if (error) throw error
      if (!data || data.length === 0) {
        setError('PIN-based login is not yet enabled for your school. Please use the standard login.')
      }
      setSchools(data || [])
    } catch (err) {
      console.error('[v0] Error fetching schools:', err)
      setError('Could not load schools. Please try again.')
    } finally {
      setSchoolsLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate input
      if (!welcomePassword.trim()) {
        throw new Error('Please enter the welcome password')
      }
      if (!pin.trim() || pin.length !== 4) {
        throw new Error('Please enter your 4-digit PIN')
      }
      if (!school) {
        throw new Error('Please select your school')
      }

      // First, verify welcome password against school
      const { data: schoolData } = await supabase
        .from('schools')
        .select('admin_password')
        .eq('id', school)
        .single()

      if (!schoolData || schoolData.admin_password !== welcomePassword) {
        throw new Error('Invalid welcome password. Please try again.')
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
        .eq('school_id', school)
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
        schoolId: school,
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

          <form onSubmit={handleLogin} className="space-y-4">
            {/* School Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Your School *
              </label>
              {schoolsLoading ? (
                <div className="text-sm text-gray-500">Loading schools...</div>
              ) : (
                <select
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">-- Select School --</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Welcome Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Welcome Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={welcomePassword}
                  onChange={(e) => setWelcomePassword(e.target.value)}
                  placeholder="Enter welcome password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-900"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

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
            <h4 className="text-sm font-medium text-blue-900 mb-2">First time logging in?</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✓ Your school admin registered your account</li>
              <li>✓ Check your email for the welcome message with your PIN</li>
              <li>✓ Enter the welcome password and PIN above</li>
            </ul>
          </div>

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
