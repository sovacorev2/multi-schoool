'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getTeacherAssignedClasses } from '@/app/actions/teacher-access'
import { useClass } from '@/lib/class-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogOut, BookOpen, ArrowRight, AlertCircle } from 'lucide-react'

interface TeacherSession {
  teacherId: string
  name: string
  email: string
  schoolId: string
  pin: string
}

interface AssignedClass {
  id: string
  name: string
  schoolId: string
  subjects: Array<{ id: string; code: string; name: string }>
  isClassTeacher: boolean
  allSubjects: string[]
}

export default function TeacherDashboard() {
  const router = useRouter()
  const { setCurrentClass, setIsAdminBypass } = useClass()
  const [session, setSession] = useState<TeacherSession | null>(null)
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSession = async () => {
      const sessionStr = localStorage.getItem('teacher_session')
      if (!sessionStr) {
        console.log('[v0] No teacher_session found, redirecting to login')
        router.push('/teacher-pin-login')
        return
      }
      
      try {
        const teacherSession = JSON.parse(sessionStr) as TeacherSession
        console.log('[v0] Loaded teacher session:', teacherSession.teacherId, teacherSession.name)
        setSession(teacherSession)
        
        // Fetch authorized classes/subjects from database
        console.log('[v0] Fetching assigned classes for teacher:', teacherSession.teacherId)
        const result = await getTeacherAssignedClasses(teacherSession.teacherId)
        
        if (result.success) {
          console.log('[v0] Got assigned classes:', result.classes.length)
          setAssignedClasses(result.classes)
        } else {
          console.error('[v0] Failed to get assigned classes:', result.error)
          setError('Failed to load your assigned classes')
        }
      } catch (err) {
        console.error('[v0] Failed to parse session:', err)
        setError('Session error')
        router.push('/teacher-pin-login')
        return
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [router])

  const handleLogout = () => {
    console.log('[v0] Teacher logging out')
    localStorage.removeItem('teacher_session')
    localStorage.removeItem('teacher_pin')
    localStorage.removeItem('teacher_authenticated')
    localStorage.removeItem('teacher_id')
    localStorage.removeItem('class_id')
    router.push('/teacher-pin-login')
  }

  const handleAccessClass = async (classId: string, className: string, schoolId: string) => {
    try {
      console.log('[v0] Teacher accessing class:', classId, className)
      
      // CRITICAL: Clear any stale admin bypass flag from a previous admin session.
      // PIN teachers must NEVER be treated as admin, otherwise subject restrictions
      // are skipped and they see/edit all subjects.
      setIsAdminBypass(false)
      localStorage.removeItem('success_academy_admin_bypass')
      
      // Store the teacher info in localStorage
      localStorage.setItem('teacher_authenticated', 'true')
      localStorage.setItem('teacher_id', session?.teacherId || '')
      localStorage.setItem('class_id', classId)
      
      // Fetch full class data from database
      const supabase = createClient()
      const { data: classData, error: fetchError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()
      
      if (fetchError || !classData) {
        console.error('[v0] Failed to fetch class:', fetchError)
        setError('Failed to load class details')
        return
      }
      
      // Set class in context (this bypasses password requirement for PIN-authenticated teachers)
      setCurrentClass({
        id: classData.id,
        name: classData.name,
        code: classData.code,
        teacher_name: classData.teacher_name,
        school_id: schoolId || classData.school_id,
        password: classData.password,
        created_at: classData.created_at,
        display_order: classData.display_order
      })
      
      // Redirect to marks entry - layout will see currentClass is set and won't redirect
      router.push(`/dashboard/marks?class=${classId}`)
    } catch (error) {
      console.error('[v0] Error accessing class:', error)
      setError('Failed to access class. Please try again.')
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
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-300 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Subject Restrictions Notice */}
        {assignedClasses.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600 rounded-lg">
            <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
              Subject Restrictions Active: You can only edit and manage subjects you are assigned to teach.
            </p>
          </div>
        )}

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
                      {cls.isClassTeacher ? 'Class Teacher' : cls.subjects.length + ' subject' + (cls.subjects.length !== 1 ? 's' : '')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-foreground dark:text-foreground font-medium mb-2">
                          {cls.isClassTeacher ? 'Teaching All Subjects' : 'Teaching:'}
                        </p>
                        <div className="space-y-1">
                          {cls.isClassTeacher ? (
                            <p className="text-muted-foreground dark:text-muted-foreground text-sm italic">All subjects in this class</p>
                          ) : (
                            cls.subjects.map((subject: any) => (
                              <p key={subject.id} className="text-foreground dark:text-foreground text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary dark:bg-accent rounded-full"></span>
                                {subject.code || subject.name}
                              </p>
                            ))
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAccessClass(cls.id, cls.name, cls.schoolId)}
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
                <p className="text-muted-foreground dark:text-muted-foreground">
                  {isLoading ? 'Loading your classes...' : 'No classes assigned yet. Contact your school administrator.'}
                </p>
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
