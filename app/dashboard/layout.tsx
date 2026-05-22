'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { checkTeacherAuth, checkAdminAuth, logoutTeacher, logoutAdmin } from '@/app/actions/auth'
import { LogOut, Users, BookOpen, ClipboardList, FileText, ChevronDown, Shield, Clock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sessionDropdown, setSessionDropdown] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [upcomingDeadline, setUpcomingDeadline] = useState<{
    exam_type: string;
    term: string;
    year: number;
    deadline: Date;
    timeRemaining: string;
  } | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { currentClass, currentSession, setCurrentClass, setCurrentSession } = useClass()
  const { currentSchool, clearSchool } = useSchool()

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
      // Redirect to school's home page (never to select-school)
      const schoolCode = currentSchool?.code
      setCurrentClass(null)
      setCurrentSession(null)
      // Always redirect to school's home page
      router.push(`/?school=${schoolCode || 'st-james'}`)
    }
  }

  const handleChangeClass = () => {
    // Implement class change logic here
  }

  useEffect(() => {
    if (isAuthenticated !== null) return

    const checkAuth = async () => {
      // Check for admin bypass from admin portal FIRST
      const searchParams = new URLSearchParams(window.location.search)
      const adminBypass = searchParams.get('adminBypass') === 'true'
      
      // Admin bypass takes priority over everything
      if (adminBypass) {
        // Admin is accessing from admin portal - class is in localStorage, just authenticate
        setIsAdmin(false)
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
        
        // Check teacher auth
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Verifying access...</div>
      </div>
    )
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
    // Admin tab - only visible to admins
    ...(isAdmin ? [{ href: '/dashboard/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
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
                <h1 className="text-2xl font-bold text-gray-900">{currentSchool?.name || 'School'}</h1>
                <p className="text-sm text-gray-600">{currentClass.name}</p>
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

              {/* For Teachers ONLY: Session Dropdown and Logout - Strict condition */}
              {isAdmin === false && isAuthenticated === true && (
                <>
                  {/* Session Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setSessionDropdown(!sessionDropdown)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all text-sm font-medium"
                    >
                      <span className="text-xs">
                        {currentSession?.exam_types?.name} • {currentSession?.term}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {sessionDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-3 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-600 uppercase">Current Session</p>
                        </div>
                        <button
                          onClick={() => {
                            setCurrentSession(null)
                            setCurrentClass(null)
                            // Redirect to school's landing page with school code
                            router.push(`/?school=${currentSchool?.code}`)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-all"
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
          <nav className="flex items-center gap-1 border-t border-gray-200 pt-4 -mx-6 px-6 overflow-x-auto scrollbar-hide">
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
                        : 'text-gray-700 hover:bg-gray-100'
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
