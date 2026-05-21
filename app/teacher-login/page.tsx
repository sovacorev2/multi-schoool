'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function TeacherLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [schools, setSchools] = useState<Array<{ id: string; name: string; feature_pin_management: boolean }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPin, setShowPin] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    // Fetch schools for dropdown
    const fetchSchools = async () => {
      const { data } = await supabase
        .from('schools')
        .select('id, name, feature_pin_management')
        .eq('is_active', true)
        .order('name')

      if (data) {
        setSchools(data)
      }
    }

    fetchSchools()
  }, [])

  // Get selected school's PIN management status
  const selectedSchool = schools.find(s => s.id === schoolId)
  const hasPinManagement = selectedSchool?.feature_pin_management === true

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // If school has PIN management, validate PIN
      if (hasPinManagement) {
        if (!pin || pin.length !== 4) {
          setError('Please enter your 4-digit PIN')
          setIsLoading(false)
          return
        }

        // Verify welcome password (stored as admin_password)
        const { data: schoolData } = await supabase
          .from('schools')
          .select('admin_password')
          .eq('id', schoolId)
          .single()

        if (!schoolData || schoolData.admin_password !== password) {
          setError('Invalid welcome password. Please try again.')
          setIsLoading(false)
          return
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
          setError('Invalid PIN or teacher not found. Please check and try again.')
          setIsLoading(false)
          return
        }

        // Get school name for PWA
        const { data: schoolInfo } = await supabase
          .from('schools')
          .select('name')
          .eq('id', schoolId)
          .single()

        // Store session in localStorage
        const session = {
          teacherId: teacher.id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          email: teacher.email,
          schoolId: schoolId,
          pin: pin,
          assignments: teacher.teacher_assignments || [],
          loginTime: new Date().toISOString(),
        }

        localStorage.setItem('teacher_session', JSON.stringify(session))
        localStorage.setItem('teacher_pin', pin)
        localStorage.setItem('current_school_id', schoolId)
        localStorage.setItem('current_school_name', schoolInfo?.name || 'Shuletech')

        // Redirect to teacher dashboard
        router.push('/teacher/dashboard')
      } else {
        // Standard login (email + password)
        const response = await fetch('/api/teacher-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, schoolId }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Login failed')
          setIsLoading(false)
          return
        }

        // Redirect to teacher dashboard
        router.push('/teacher/dashboard')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('[v0] Login error:', err)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Teacher Login</h1>
        <p className="text-gray-600 text-sm mb-6">Sign in with your teacher credentials</p>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* School Selection */}
          <div>
            <label htmlFor="school" className="block text-sm font-medium text-gray-700 mb-2">
              School
            </label>
            <select
              id="school"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select your school</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* Email - only show for non-PIN schools */}
          {!hasPinManagement && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required={!hasPinManagement}
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {hasPinManagement ? 'Welcome Password' : 'Password'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={hasPinManagement ? 'Enter welcome password' : '••••••••'}
              required
            />
          </div>

          {/* PIN - only show for PIN-enabled schools */}
          {hasPinManagement && (
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                Your 4-Digit PIN
              </label>
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 4))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono"
                placeholder="0000"
                maxLength={4}
                inputMode="numeric"
              />
              <p className="text-xs text-gray-500 mt-1">Check your email for your PIN</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !schoolId}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
          >
            {isLoading ? 'Logging in...' : 'Sign In'}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your school admin
          </p>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">
              Want to access as a class/admin instead?
            </p>
            <Link href="/login" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Go to Main Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
