'use client'

// Admin Portal - Clean, simple, production-ready
// No subscriptions, no complex logic, just works

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { CurriculumSelector } from './curriculum-selector'
import { LogOut, Lock, Unlock, RefreshCw } from 'lucide-react'

interface AdminSession {
  id: string
  school_id: string
  class_id: string
  year: number
  term: number
  is_locked: boolean
  created_at: string
  class?: { name: string }
}

interface SchoolData {
  id: string
  name: string
  code: string
  admin_password: string
}

interface ClassData {
  id: string
  name: string
  grade: string
  capacity: number
}

export default function AdminPortalPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [classes, setClasses] = useState<ClassData[]>([])
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createClient()

  const loadData = async (code: string) => {
    try {
      // Fetch school
      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .select('*')
        .eq('code', code)
        .maybeSingle()

      if (schoolErr || !school) {
        setError('School not found')
        return
      }

      setSchoolData(school)

      // Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', school.id)

      setClasses(classesData || [])

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('school_id', school.id)

      setSessions(sessionsData || [])
    } catch (err) {
      setError('Error loading data: ' + (err as any).message)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: school } = await supabase
        .from('schools')
        .select('*')
        .eq('code', schoolCode)
        .maybeSingle()

      if (!school) {
        setError('Invalid school code')
        setLoading(false)
        return
      }

      if (school.admin_password !== password) {
        setError('Invalid password')
        setLoading(false)
        return
      }

      setAuthenticated(true)
      await loadData(schoolCode)
    } catch (err) {
      setError('Login failed: ' + (err as any).message)
    }

    setLoading(false)
  }

  const toggleLock = async (sessionId: string, locked: boolean) => {
    try {
      await supabase
        .from('sessions')
        .update({ is_locked: !locked })
        .eq('id', sessionId)

      setRefreshing(true)
      await loadData(schoolCode)
      setRefreshing(false)
    } catch (err) {
      setError('Failed to update session')
    }
  }

  const handleLogout = () => {
    setAuthenticated(false)
    setPassword('')
    setSchoolData(null)
    setClasses([])
    setSessions([])
    setError('')
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <div className="p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Portal</h1>
            <p className="text-gray-600 text-sm mb-6">School Management System</p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School Code
                </label>
                <Input
                  type="text"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="e.g., STM001"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading || !schoolCode || !password}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Loading...' : 'Login'}
              </Button>
            </div>
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded text-red-800">
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
          <TabsContent value="subjects">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Manage Curriculum</h2>
              <CurriculumSelector schoolId={schoolData?.id} />
            </Card>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Classes ({classes.length})</h2>
              {classes.length === 0 ? (
                <p className="text-gray-600">No classes found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls) => (
                    <Card key={cls.id} className="p-4">
                      <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                      <p className="text-sm text-gray-600">Grade: {cls.grade}</p>
                      <p className="text-sm text-gray-600">Capacity: {cls.capacity}</p>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Exam Sessions ({sessions.length})</h2>
                <Button
                  onClick={() => loadData(schoolCode)}
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>

              {sessions.length === 0 ? (
                <p className="text-gray-600">No sessions found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Class</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Year</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Term</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Status</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Created</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{session.class?.name || 'N/A'}</td>
                          <td className="px-4 py-2">{session.year}</td>
                          <td className="px-4 py-2">Term {session.term}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              session.is_locked
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {session.is_locked ? 'Locked' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {new Date(session.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => toggleLock(session.id, session.is_locked)}
                            >
                              {session.is_locked ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  Unlock
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
