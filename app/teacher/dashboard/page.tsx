'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TeacherSession } from '@/lib/types/teacher'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { LogOut, BookOpen, Users } from 'lucide-react'

export default function TeacherDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<TeacherSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSession = () => {
      // Get session from localStorage (set by login page)
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

  const handleLogout = async () => {
    // Clear session cookie
    await fetch('/api/teacher-logout', { method: 'POST' })
    router.push('/teacher-login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome, {session.firstName} {session.lastName}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Your Classes
            </h3>
            <div className="space-y-2">
              {session.assignedClasses.length > 0 ? (
                session.assignedClasses.map((cls: any) => (
                  <div key={cls.id} className="text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                    {cls.name}
                  </div>
                ))
              ) : (
                <p className="text-gray-600">No classes assigned yet</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              Your Subjects
            </h3>
            <div className="space-y-2">
              {session.assignedSubjects.length > 0 ? (
                session.assignedSubjects.map((subject: any) => (
                  <div key={subject.id} className="text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                    {subject.name}
                  </div>
                ))
              ) : (
                <p className="text-gray-600">Teaching all subjects in assigned classes</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/marklist" className="block">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                View Marklist
              </Button>
            </Link>
            <Link href="/dashboard/learners" className="block">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                View Learners
              </Button>
            </Link>
            <Link href="/dashboard/class-teacher-remarks" className="block">
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                Class Reports
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-blue-900 mb-2">About Your Access</h4>
          <p className="text-blue-800">
            You can view marks for all classes at your school, but you can only edit marks for your assigned classes and subjects.
            Your school admin has configured your access based on your teaching responsibilities.
          </p>
        </div>
      </main>
    </div>
  )
}
