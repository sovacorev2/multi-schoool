'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogOut, BookOpen, ArrowRight } from 'lucide-react'

interface TeacherSession {
  teacherId: string
  name: string
  email: string
  schoolId: string
  pin: string
  assignments: Array<any>
  loginTime: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<TeacherSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSession = () => {
      const sessionStr = localStorage.getItem('teacher_session')
      if (!sessionStr) {
        router.push('/teacher-pin-login')
        return
      }
      
      try {
        const teacherSession = JSON.parse(sessionStr) as TeacherSession
        setSession(teacherSession)
      } catch (error) {
        console.error('[v0] Failed to parse session:', error)
        router.push('/teacher-pin-login')
        return
      }
      setIsLoading(false)
    }

    loadSession()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('teacher_session')
    localStorage.removeItem('teacher_pin')
    router.push('/teacher-pin-login')
  }

  const getUniqueClasses = () => {
    if (!session?.assignments) return []
    const classMap = new Map()
    session.assignments.forEach((assignment: any) => {
      if (assignment.classes?.id && !classMap.has(assignment.classes.id)) {
        classMap.set(assignment.classes.id, {
          id: assignment.classes.id,
          name: assignment.classes.name,
          subjects: []
        })
      }
      if (assignment.classes?.id && assignment.subjects) {
        const cls = classMap.get(assignment.classes.id)
        if (!cls.subjects.find((s: any) => s.id === assignment.subjects.id)) {
          cls.subjects.push({
            id: assignment.subjects.id,
            name: assignment.subjects.name
          })
        }
      }
    })
    return Array.from(classMap.values())
  }

  const handleAccessClass = (classId: string, className: string) => {
    // Store current class in session for marks entry
    localStorage.setItem('teacher_current_class', JSON.stringify({ id: classId, name: className }))
    // Redirect to marks page
    router.push(`/dashboard/marks?class=${classId}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const assignedClasses = getUniqueClasses()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teacher Portal</h1>
            <p className="text-gray-600 mt-1">Welcome, {session.name}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Classes Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Your Assigned Classes
          </h2>

          {assignedClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedClasses.map((cls: any) => (
                <Card key={cls.id} className="hover:shadow-lg transition-shadow cursor-pointer bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-900">{cls.name}</CardTitle>
                    <CardDescription>
                      {cls.subjects.length} subject{cls.subjects.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-gray-600 font-medium mb-2">Teaching:</p>
                        <div className="space-y-1">
                          {cls.subjects.map((subject: any) => (
                            <p key={subject.id} className="text-gray-700 text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                              {subject.name}
                            </p>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAccessClass(cls.id, cls.name)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4 flex items-center justify-between"
                      >
                        Start Marks Entry
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-white">
              <CardContent className="pt-6 text-center">
                <p className="text-gray-600">No classes assigned yet. Contact your school administrator.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info Box */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 text-sm space-y-2">
            <p>✓ Click on a class card to start entering marks</p>
            <p>✓ Marks are automatically saved as you enter them</p>
            <p>✓ Use the Save button at the bottom to finalize your entries</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
