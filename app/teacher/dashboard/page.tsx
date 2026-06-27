'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
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
  const { setCurrentClass } = useClass()
  const { setSchool } = useSchool()
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

  const handleAccessClass = async (classId: string, className: string) => {
    try {
      // Fetch the full class object from database
      const supabase = createClient()
      const { data: classData } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()

      if (classData) {
        // Set class in context AND localStorage so dashboard layout recognizes auth
        setCurrentClass(classData)
        localStorage.setItem('current_class', JSON.stringify(classData))
        localStorage.setItem('teacher_current_class', JSON.stringify({ id: classId, name: className }))
      }

      // Redirect directly to marks entry for this class - no password needed
      router.push(`/dashboard/marks?class=${classId}`)
    } catch (error) {
      console.error('[v0] Error accessing class:', error)
      alert('Failed to access class. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary dark:border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground dark:text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const assignedClasses = getUniqueClasses()

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Header */}
      <header className="bg-card dark:bg-card shadow-sm border-b border-border dark:border-border">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Teacher Portal</h1>
            <p className="text-muted-foreground dark:text-muted-foreground mt-1">Welcome, {session.name}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 text-red-600 dark:text-red-400 border-red-600 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
          <h2 className="text-2xl font-bold text-foreground dark:text-foreground mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary dark:text-accent" />
            Your Assigned Classes
          </h2>

          {assignedClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedClasses.map((cls: any) => (
                <Card key={cls.id} className="hover:shadow-lg transition-shadow cursor-pointer bg-card dark:bg-card border-border dark:border-border">
                  <CardHeader>
                    <CardTitle className="text-lg text-foreground dark:text-foreground">{cls.name}</CardTitle>
                    <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                      {cls.subjects.length} subject{cls.subjects.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-foreground dark:text-foreground font-medium mb-2">Teaching:</p>
                        <div className="space-y-1">
                          {cls.subjects.map((subject: any) => (
                            <p key={subject.id} className="text-foreground dark:text-foreground text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-primary dark:bg-accent rounded-full"></span>
                              {subject.name}
                            </p>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAccessClass(cls.id, cls.name)}
                        className="w-full bg-primary dark:bg-accent hover:bg-primary/90 dark:hover:bg-accent/90 text-white mt-4 flex items-center justify-between"
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
            <Card className="bg-card dark:bg-card border-border dark:border-border">
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground dark:text-muted-foreground">No classes assigned yet. Contact your school administrator.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info Box */}
        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-foreground dark:text-foreground">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-foreground dark:text-foreground text-sm space-y-2">
            <p>✓ Click on a class card to start entering marks</p>
            <p>✓ Marks are automatically saved as you enter them</p>
            <p>✓ Use the Save button at the bottom to finalize your entries</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
