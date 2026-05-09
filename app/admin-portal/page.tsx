'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { CurriculumSelector } from './curriculum-selector'
import { LogOut, Lock, Unlock } from 'lucide-react'

export default function AdminPortalPage() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolData, setSchoolData] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.user_metadata?.school_code) {
        setAuthenticated(true)
        setSchoolCode(session.user.user_metadata.school_code)
        await loadSchoolData(session.user.user_metadata.school_code)
      }
    }
    checkAuth()
  }, [])

  // Load school data (classes and sessions)
  const loadSchoolData = async (code: string) => {
    if (!code) return
    
    setLoading(true)
    setError('')
    try {
      // Get school by code
      const { data: schools, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('code', code)
        .single()

      if (schoolError) throw schoolError

      setSchoolData(schools)

      // Get classes
      const { data: classesData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schools.id)
        .order('name')

      if (classError) throw classError
      setClasses(classesData || [])

      // Get sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, class:class_id(name)')
        .eq('school_id', schools.id)
        .order('created_at', { ascending: false })

      if (sessionsError) throw sessionsError
      setSessions(sessionsData || [])
    } catch (err) {
      console.error('[v0] Error loading school data:', err)
      setError('Failed to load school data: ' + (err as any)?.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle authentication
  const handleAuthenticate = async () => {
    setLoading(true)
    setError('')
    try {
      // Get school by code
      const { data: schools, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('code', schoolCode)
        .single()

      if (schoolError) throw new Error('School not found')

      // Check password (you should hash this in production)
      if (schools.admin_password !== password) {
        throw new Error('Invalid password')
      }

      setAuthenticated(true)
      setSchoolData(schools)
      await loadSchoolData(schoolCode)
    } catch (err) {
      setError((err as any)?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  // Lock/unlock session
  const toggleSessionLock = async (sessionId: string, currentLocked: boolean) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ is_locked: !currentLocked })
        .eq('id', sessionId)

      if (error) throw error
      await loadSchoolData(schoolCode)
    } catch (err) {
      console.error('[v0] Error updating session:', err)
      setError('Failed to update session')
    }
  }

  // Logout
  const handleLogout = () => {
    setAuthenticated(false)
    setSchoolCode('')
    setPassword('')
    setSchoolData(null)
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Portal</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Code
              </label>
              <Input
                type="text"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="e.g., STM"
                className="w-full"
                onKeyPress={(e) => e.key === 'Enter' && handleAuthenticate()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full"
                onKeyPress={(e) => e.key === 'Enter' && handleAuthenticate()}
              />
            </div>
            {error && <div className="p-3 bg-red-100 text-red-800 rounded text-sm">{error}</div>}
            <Button
              onClick={handleAuthenticate}
              disabled={loading || !schoolCode || !password}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{schoolData?.name}</h1>
            <p className="text-sm text-gray-600">Code: {schoolData?.code}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded">
            {error}
          </div>
        )}

        <Tabs defaultValue="subjects" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          {/* Subjects Tab */}
          <TabsContent value="subjects" className="space-y-4">
            <div className="bg-white rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Curriculum Management</h2>
              <CurriculumSelector schoolId={schoolData?.id} />
            </div>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes" className="space-y-4">
            <div className="bg-white rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Classes ({classes.length})</h2>
              {classes.length === 0 ? (
                <p className="text-gray-600">No classes found</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {classes.map((cls: any) => (
                    <Card key={cls.id} className="p-4">
                      <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                      <p className="text-sm text-gray-600">Grade {cls.grade}</p>
                      <p className="text-sm text-gray-600 mt-2">Capacity: {cls.capacity}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <div className="bg-white rounded-lg p-6 border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Exam Sessions ({sessions.length})</h2>
                <Button
                  onClick={() => loadSchoolData(schoolCode)}
                  variant="outline"
                  size="sm"
                >
                  Refresh
                </Button>
              </div>

              {sessions.length === 0 ? (
                <p className="text-gray-600">No sessions found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Class</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Year</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Term</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Created</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session: any) => (
                        <tr key={session.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium">{session.class?.name}</td>
                          <td className="px-4 py-2 text-sm">{session.year}</td>
                          <td className="px-4 py-2 text-sm">Term {session.term}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              session.is_locked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {session.is_locked ? 'Locked' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {new Date(session.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => toggleSessionLock(session.id, session.is_locked)}
                            >
                              {session.is_locked ? (
                                <>
                                  <Unlock className="w-4 h-4" />
                                  Unlock
                                </>
                              ) : (
                                <>
                                  <Lock className="w-4 h-4" />
                                  Lock
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
