'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { checkTeacherAuth, checkAdminAuth, logoutTeacher, logoutAdmin } from '@/app/actions/auth'
import { LogOut, Users, BookOpen, ClipboardList, FileText, ChevronDown, Shield } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sessionDropdown, setSessionDropdown] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
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
      setCurrentClass(null)
      setCurrentSession(null)
      clearSchool()
      router.push('/select-school')
    }
  }

  const handleChangeClass = () => {
    // Implement class change logic here
  }

  useEffect(() => {
    async function checkAuth() {
      // If currentSession is set (along with currentClass), this is an ADMIN
      if (currentClass && currentSession) {
        setIsAdmin(true)
        setIsAuthenticated(true)
        return
      }
      
      // If only currentClass is set (no session), this is a TEACHER
      if (currentClass) {
        setIsAdmin(false)
        
        // Check teacher auth
        const isAuth = await checkTeacherAuth(currentClass.id)
        if (!isAuth) {
          // Redirect to password page - REQUIRED for security
          const className = encodeURIComponent(currentClass.name)
          router.push(`/auth/teacher?classId=${currentClass.id}&className=${className}`)
          return
        }
        
        setIsAuthenticated(true)
        return
      }
      
      // If no currentClass, check if this is an admin trying to access /dashboard
      const adminAuth = await checkAdminAuth()
      if (adminAuth) {
        // Admins should not access /dashboard - redirect to admin portal
        window.location.href = '/admin-portal'
        return
      }
      
      // Neither teacher nor admin - redirect to home
      router.push('/')
    }
    checkAuth()
  }, [currentClass, currentSession, router])

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
      {/* Horizontal Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentSchool?.name || 'School'}</h1>
              <p className="text-sm text-gray-600">{currentClass.name}</p>
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
                            router.push('/')
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

          {/* Horizontal Navigation */}
          <nav className="flex items-center gap-1 border-t border-gray-200 pt-4 -mx-6 px-6 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
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
