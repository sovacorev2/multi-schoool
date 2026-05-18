'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Lock, Key } from 'lucide-react'

export default function TeacherLoginSelection() {
  const router = useRouter()
  const supabase = createClient()
  const [schools, setSchools] = useState<Array<{ id: string; name: string; enable_pin_login: boolean }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSchools()
  }, [])

  async function fetchSchools() {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, enable_pin_login')
        .order('name')

      if (error) throw error
      setSchools(data || [])
    } catch (err) {
      console.error('[v0] Error fetching schools:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const shuleTechSchool = schools.find(s => s.enable_pin_login)
  const otherSchools = schools.filter(s => !s.enable_pin_login)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Teacher Login</h1>
          <p className="text-lg text-gray-600">Select your school and login method</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-600">Loading schools...</div>
        ) : (
          <div className="space-y-6">
            {/* ShuleTech - PIN Login */}
            {shuleTechSchool && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-300 to-transparent"></div>
                  <span className="text-sm font-semibold text-blue-600">PIN-BASED LOGIN (NEW)</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-blue-300 to-transparent"></div>
                </div>
                <Card className="border-2 border-blue-200 bg-blue-50 hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => router.push('/teacher-pin-login')}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                          <Key className="w-5 h-5" />
                          {shuleTechSchool.name}
                        </CardTitle>
                        <CardDescription className="text-blue-700">
                          Login with 4-digit PIN + Welcome Password
                        </CardDescription>
                      </div>
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">PILOT</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-blue-800">
                      <p>✓ Unique PIN sent via email</p>
                      <p>✓ Simple and secure login</p>
                      <p>✓ Teacher assignments auto-loaded</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Other Schools - Standard Login */}
            {otherSchools.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-gray-300 to-transparent"></div>
                  <span className="text-sm font-semibold text-gray-600">STANDARD LOGIN</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-gray-300 to-transparent"></div>
                </div>
                <div className="space-y-2">
                  {otherSchools.map((school) => (
                    <Card
                      key={school.id}
                      className="hover:border-gray-400 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => router.push('/')}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Lock className="w-4 h-4 text-gray-600" />
                              {school.name}
                            </CardTitle>
                            <CardDescription>
                              Class password authentication
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Note:</span> PIN-based login is currently a pilot feature for SHULE TECH. Other schools use standard class-based authentication.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
