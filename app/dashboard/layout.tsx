'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { checkTeacherAuth, checkAdminAuth, logoutTeacher, logoutAdmin } from '@/app/actions/auth'
import { LogOut, Users, BookOpen, ClipboardList, FileText, ChevronDown, Shield, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SchoolLockedScreen } from '@/components/school-locked-screen'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sessionDropdown, setSessionDropdown] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAdminBypassMode, setIsAdminBypassMode] = useState(false)
  const [adminBypassSchool, setAdminBypassSchool] = useState<string | null>(null)
  const [upcomingDeadline, setUpcomingDeadline] = useState<{
    exam_type: string;
    term: string;
    year: number;
    deadline: Date;
    timeRemaining: string;
  } | null>(null)
  const [schoolLockCheck, setSchoolLockCheck] = useState<{ isLocked: boolean; name: string; logo_url: string | null; primary_color: string | null } | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { currentClass, currentSession, setCurrentClass, setCurrentSession, setIsAdminBypass } = useClass()
  const { currentSchool, clearSchool } = useSchool()

  // A cached currentSchool can be stale (locked after it was last fetched), so
  // re-verify is_active fresh on every visit instead of trusting localStorage -
  // this is the actual marks-entry gate, so a stale "unlocked" reading here would
  // let a locked school keep working exactly where it matters most.
  useEffect(() => {
    if (!currentSchool?.id) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('schools')
      .select('is_active, name, logo_url, primary_color')
      .eq('id', currentSchool.id)
      .single()
      .then(({ data }: { data: { is_active: boolean; name: string; logo_url: string | null; primary_color: string | null } | null }) => {
        if (cancelled || !data) return
        setSchoolLockCheck({ isLocked: data.is_active === false, name: data.name, logo_url: data.logo_url, primary_color: data.primary_color })
      })
    return () => { cancelled = true }
  }, [currentSchool?.id])

  const handleLogout = async () => {
    try {
      if (isAdmin) {
        await logoutAdmin()
      } else {
        await logoutTeacher()
      }
    } catch (err) {
      console.error('[v0] Logout error:', err)
    } finally {
      const schoolCode = currentSchool?.code
      setCurrentClass(null)
      setCurrentSession(null)
      if (schoolCode) {
        router.push(`/?school=${schoolCode}`)
      } else {
        router.back()
      }
    }
  }

  const handleChangeClass = () => {
    // Implement class change logic here
  }

  useEffect(() => {
    if (isAuthenticated !== null) return

    const checkAuth = async () => {
      // Check for admin bypass from admin portal FIRST (from URL param or stored in context)
      const searchParams = new URLSearchParams(window.location.search)
      const adminBypass = searchParams.get('adminBypass') === 'true'

      // SELF-HEALING: If a PIN teacher session exists, this is a teacher, NOT an admin.
      // Clear any stale admin bypass flag left over from a previous admin session so
      // subject restrictions are correctly enforced.
      const hasTeacherSession = !!localStorage.getItem('teacher_session') || !!localStorage.getItem('teacher_id')
      if (hasTeacherSession && !adminBypass) {
        localStorage.removeItem('success_academy_admin_bypass')
        setIsAdminBypass(false)
      }

      const isStoredAdminBypass = localStorage.getItem("success_academy_admin_bypass") === "true"
      const storedBypassSchool = localStorage.getItem("admin_bypass_school")
      
      // Admin bypass takes priority over everything
      if (adminBypass || isStoredAdminBypass) {
        // Admin is accessing from admin portal - class is in localStorage, just authenticate
        if (adminBypass) setIsAdminBypass(true)
        setIsAdmin(false)
        setIsAdminBypassMode(true)
        setAdminBypassSchool(storedBypassSchool)
        setIsAuthenticated(true)
        return
      }
      
      // Check if this is an admin accessing their own admin portal
      if (currentSession?.admin_id && !adminBypass) {
        setIsAdmin(true)
        setIsAuthenticated(true)
        return
      }
      
      // Teacher flow: must have currentClass set
      if (currentClass) {
        setIsAdmin(false)
        
        // Check if teacher is PIN-authenticated (came from teacher PIN login)
        const teacherSession = localStorage.getItem('teacher_session')
        if (teacherSession) {
          // PIN-authenticated teacher - bypass password auth, go directly to marks
          setIsAuthenticated(true)
          return
        }
        
        // Check teacher auth (password-based)
        const isAuth = await checkTeacherAuth(currentClass.id)
        if (!isAuth) {
          const className = encodeURIComponent(currentClass.name)
          router.push(`/auth/teacher?classId=${currentClass.id}&className=${className}`)
          return
        }
        
        setIsAuthenticated(true)
        return
      }
      
      // Fallback: redirect to home
      router.push('/')
    }
    checkAuth()
  }, [currentClass, currentSession, router])

  // Fetch upcoming deadlines for teachers
  useEffect(() => {
    if (!currentClass || isAdmin) return

    const fetchDeadlines = async () => {
      const supabase = createClient()
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*, exam_types(name)')
        .eq('class_id', currentClass.id)
        .not('deadline_datetime', 'is', null)
        .not('exam_type_id', 'is', null)
        .eq('is_locked', false)
        .order('deadline_datetime', { ascending: true })
        .limit(1)

      if (sessions && sessions.length > 0) {
        const session = sessions[0]
        const deadline = new Date(session.deadline_datetime)
        const now = new Date()
        
        if (deadline > now) {
          const diffMs = deadline.getTime() - now.getTime()
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          
          let timeRemaining = ''
          if (diffDays > 0) {
            timeRemaining = `${diffDays}d ${diffHours}h`
          } else if (diffHours > 0) {
            timeRemaining = `${diffHours}h ${diffMins}m`
          } else {
            timeRemaining = `${diffMins}m`
          }

          setUpcomingDeadline({
            exam_type: session.exam_types?.name || 'Exam',
            term: session.term,
            year: session.year,
            deadline,
            timeRemaining
          })
        }
      }
    }

    fetchDeadlines()
    // Update countdown every minute
    const interval = setInterval(fetchDeadlines, 60000)
    return () => clearInterval(interval)
  }, [currentClass, isAdmin])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    )
  }

  // A lock always wins, even mid-session - this is the actual marks-entry surface,
  // so it's the one place this absolutely cannot be bypassed by a stale cache.
  if (schoolLockCheck?.isLocked) {
    return <SchoolLockedScreen school={schoolLockCheck} variant="public" />
  }

  // If admin is accessing but no class is set, show class selection for admin
  if (!currentClass && !isAdmin) {
    router.push('/')
    return null
  }

  if (!isAuthenticated) {
    return null
  }

  const navItems = [
    { href: '/dashboard/learners', label: 'Learners', icon: Users },
    { href: '/dashboard/subjects', label: 'Subjects', icon: BookOpen },
    { href: '/dashboard/marks', label: 'Marks', icon: ClipboardList },
    { href: '/dashboard/marklist', label: 'Marklist', icon: FileText },
    { href: '/dashboard/my-subject', label: 'My Subject', icon: TrendingUp },
    // Admin tab - only visible to admins
    ...(isAdmin ? [{ href: '/dashboard/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Deadline Notice Banner for Teachers */}
      {upcomingDeadline && !isAdmin && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 sticky top-0 z-50">
          <div className="flex items-center justify-center gap-3 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">
              Marks Entry Deadline: {upcomingDeadline.exam_type} ({upcomingDeadline.term} {upcomingDeadline.year})
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {upcomingDeadline.timeRemaining} remaining
            </span>
            <span className="text-xs opacity-80">
              Due: {upcomingDeadline.deadline.toLocaleDateString()} {upcomingDeadline.deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}
      
      {/* Horizontal Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-6 py-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* School Logo */}
              {currentSchool && (
                <img 
                  src={currentSchool.logo_url || ''}
                  alt={`${currentSchool.name} logo`}
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement
                    // If logo_url from Blob fails to load, hide it
                    if (currentSchool.logo_url) {
                      target.style.display = 'none'
                    }
                    // Don't try fallback paths - only use uploaded logo or hide
                  }}
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">{currentSchool?.name || 'School'}</h1>
                <p className="text-sm text-muted-foreground">{currentClass.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* For Admins ONLY: Admin Portal Button - Strict condition */}
              {isAdmin === true && isAuthenticated === true && currentSchool && (
                <button
                  onClick={() => window.location.href = `/admin-portal?school=${currentSchool.code}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                >
                  <Shield className="w-4 h-4" />
                  Admin Portal
                </button>
              )}

              {/* For Admin Bypass Mode: Back to Admin Portal button + Logout */}
              {isAdminBypassMode && isAuthenticated === true && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const school = adminBypassSchool || currentSchool?.code
                      if (school) {
                        router.push(`/admin-portal?school=${school}`)
                      } else {
                        router.push('/admin-portal')
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 border border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-all"
                  >
                    <Shield className="w-4 h-4" />
                    Back to Admin Portal
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('success_academy_admin_bypass')
                      localStorage.removeItem('admin_bypass_school')
                      setIsAdminBypassMode(false)
                      const school = adminBypassSchool || currentSchool?.code
                      router.push(school ? `/?school=${school}` : '/')
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}

              {/* For Teachers ONLY: Session Dropdown and Logout - Strict condition */}
              {isAdmin === false && isAdminBypassMode === false && isAuthenticated === true && (
                <>
                  {/* Session Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setSessionDropdown(!sessionDropdown)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-sm font-medium"
                    >
                      <span className="text-xs">
                        {currentSession?.exam_types?.name} • {currentSession?.term}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {sessionDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border z-50">
                        <div className="p-3 border-b border-border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Current Session</p>
                        </div>
                        <button
                          onClick={() => {
                            setCurrentSession(null)
                            setCurrentClass(null)
                            // Redirect to school's landing page with school code
                            router.push(`/?school=${currentSchool?.code}`)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-all"
                        >
                          Change Session
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Horizontal Navigation - Mobile Responsive */}
          <nav className="flex items-center gap-1 border-t border-border pt-4 -mx-6 px-6 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 min-w-max pb-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-foreground hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden">{item.label.split(' ')[0]}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
