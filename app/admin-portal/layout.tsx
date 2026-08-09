'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { useClass } from '@/lib/class-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Shield, Eye, EyeOff, Settings, Clock, ArrowLeft,
  GraduationCap, Users, Lock, LogOut, CalendarClock,
} from 'lucide-react'
import { AdminPWARegistration } from '@/components/admin-pwa-registration'
import { SchoolLockedScreen } from '@/components/school-locked-screen'
import { AdminSchoolProvider, useAdminSchool } from './_shared/AdminSchoolContext'
import { SCHOOL_SELECT_FIELDS, type School } from './_shared/types'
import { sessionAuthKey } from './_shared/utils'

const navItems = [
  { href: '/admin-portal', label: 'Overview', icon: Clock, exact: true },
  { href: '/admin-portal/classes-exams', label: 'Classes & Exams', icon: GraduationCap },
  { href: '/admin-portal/teachers', label: 'Teachers', icon: Users },
  { href: '/admin-portal/timetable', label: 'Timetable', icon: CalendarClock },
  { href: '/admin-portal/access', label: 'Access & Passwords', icon: Lock },
  { href: '/admin-portal/settings', label: 'Settings & Reports', icon: Settings },
]

function AdminPortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { currentSchool, setCurrentSchool } = useSchool()
  const { setCurrentClass } = useClass()
  const { school, setSchool } = useAdminSchool()

  // Auth state
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  // Lightweight class list for the "Access Classes" quick-menu only - each
  // section page fetches its own richer copy of classes for its own UI.
  const [quickClasses, setQuickClasses] = useState<{ id: string; name: string }[]>([])
  const [showAccessClassesMenu, setShowAccessClassesMenu] = useState(false)

  // Load school from URL or context
  useEffect(() => {
    const schoolCode = searchParams.get('school')

    if (schoolCode) {
      // Trust a cached school only if it was last known active - a lock that took
      // effect after the cache was written must not be silently bypassed here.
      if (currentSchool && currentSchool.code === schoolCode && currentSchool.is_active !== false) {
        return
      }
      loadSchoolFromCode(schoolCode)
    }
  }, [searchParams, currentSchool, router])

  const loadSchoolFromCode = async (code: string) => {
    setSchool(null)
    setIsAuthenticated(false)
    setIsRestoringSession(true)
    setPassword('')

    const supabase = createClient()
    // No is_active filter here - a locked school must still be found so its admin
    // sees the "locked, contact ShuleTech" screen instead of a dead-end spinner.
    const { data } = await supabase
      .from('schools')
      .select(SCHOOL_SELECT_FIELDS)
      .eq('code', code)
      .single()

    if (data) {
      setCurrentSchool(data as any)
    } else {
      setIsRestoringSession(false)
    }
  }

  // Restore an already-authenticated session for this school (e.g. an admin who
  // just entered the password, peeked into a class via the bypass flow, and is now
  // navigating back via "Back to Admin Portal" - they shouldn't have to re-enter it).
  useEffect(() => {
    if (!currentSchool) return
    if (isAuthenticated) {
      setIsRestoringSession(false)
      return
    }
    if (typeof window === 'undefined' || sessionStorage.getItem(sessionAuthKey(currentSchool.code)) !== 'true') {
      setIsRestoringSession(false)
      return
    }

    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: schoolData } = await supabase
        .from('schools')
        .select(SCHOOL_SELECT_FIELDS)
        .eq('id', currentSchool.id)
        .single()
      if (cancelled) return
      if (schoolData) {
        setSchool(schoolData as unknown as School)
        setIsAuthenticated(true)
      } else {
        sessionStorage.removeItem(sessionAuthKey(currentSchool.code))
      }
      setIsRestoringSession(false)
    })()

    return () => { cancelled = true }
  }, [currentSchool?.id])

  // Fetch the lightweight class list once authenticated (for the header's Access Classes menu)
  useEffect(() => {
    if (!isAuthenticated || !currentSchool) return
    const supabase = createClient()
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', currentSchool.id)
      .order('display_order')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => setQuickClasses(data || []))
  }, [isAuthenticated, currentSchool?.id])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setIsAuthenticating(true)

    try {
      const supabase = createClient()
      const { data: schoolData } = await supabase
        .from('schools')
        .select(SCHOOL_SELECT_FIELDS)
        .eq('id', currentSchool?.id)
        .single()

      if (schoolData && (schoolData as any).admin_password === password) {
        setSchool(schoolData as unknown as School)
        setIsAuthenticated(true)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionAuthKey((schoolData as any).code), 'true')
        }
      } else {
        setPasswordError('Incorrect admin password')
      }
    } catch {
      setPasswordError('An error occurred. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleAccessClassAsAdmin = async (classId: string) => {
    try {
      const supabase = createClient()
      const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single()
      if (cls) setCurrentClass(cls)
    } catch (error) {
      console.log('[v0] Error fetching class:', error)
    }

    localStorage.setItem('success_academy_admin_bypass', 'true')
    const schoolParam = new URLSearchParams(window.location.search).get('school')
    if (schoolParam) localStorage.setItem('admin_bypass_school', schoolParam)

    router.push(`/dashboard?adminBypass=true&classId=${classId}`)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword('')
    if (currentSchool && typeof window !== 'undefined') {
      sessionStorage.removeItem(sessionAuthKey(currentSchool.code))
    }
    if (currentSchool) {
      window.location.href = `/?school=${currentSchool.code}`
    }
  }

  if (!currentSchool || (isRestoringSession && !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  // A lock (manual or expiry-driven) always wins, even over an already-authenticated
  // admin session - otherwise a school locked mid-session would keep full access
  // until the browser tab closed.
  if (currentSchool.is_active === false) {
    return <SchoolLockedScreen school={currentSchool} variant="admin" />
  }

  // Password screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
              >
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold mb-2">Admin Portal</CardTitle>
              <CardDescription className="text-base text-gray-600">
                {currentSchool.name} - Restricted Access
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Admin Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isAuthenticating || !password}
                className="w-full h-11 text-white font-medium"
                style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
              >
                {isAuthenticating ? 'Verifying...' : 'Login as Admin'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/?school=${currentSchool.code}`)}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main Portal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="text-white py-3 md:py-4 px-4 md:px-6 shadow-lg"
        style={{ backgroundColor: currentSchool.primary_color || '#2563eb' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-2 md:gap-3">
            <img
              src={currentSchool.logo_url || `/logos/${currentSchool.code}.png`}
              alt={`${currentSchool.name} logo`}
              className="w-10 md:w-12 h-10 md:h-12 object-contain bg-white rounded-lg p-1"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <Shield className="w-8 h-8 hidden" />
            <div className="flex-1">
              <h1 className="text-lg md:text-xl font-bold">{currentSchool.name}</h1>
              <p className="text-xs md:text-sm opacity-90">Admin Portal</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 justify-start md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccessClassesMenu(!showAccessClassesMenu)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs md:text-sm"
              title="Access any class without password"
            >
              📚 Access Classes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/?school=${currentSchool.code}`)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs md:text-sm"
            >
              Main Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>

        {/* Section nav */}
        <nav className="max-w-7xl mx-auto flex items-center gap-1 mt-3 md:mt-4 pt-3 border-t border-white/20 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={`${item.href}?school=${currentSchool.code}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 ${
                  isActive ? 'bg-white text-gray-900' : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Access Classes Menu */}
      {showAccessClassesMenu && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="font-semibold text-blue-900 mb-3">Select a Class to Access (Admin Mode)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {quickClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => handleAccessClassAsAdmin(cls.id)}
                  className="p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm"
                >
                  <div className="font-medium text-gray-900">{cls.name}</div>
                  <div className="text-xs text-gray-500 mt-1">Admin Access - No Password</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAccessClassesMenu(false)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-3 md:p-6">
        {children}

        <AdminPWARegistration schoolId={school?.id} schoolName={school?.name} />
      </main>
    </div>
  )
}

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSchoolProvider>
      <AdminPortalShell>{children}</AdminPortalShell>
    </AdminSchoolProvider>
  )
}
