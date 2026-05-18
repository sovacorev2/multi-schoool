"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { checkAdminAuth } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { 
  Shield, 
  Home,
  Users, 
  BookOpen, 
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Key
} from "lucide-react"
import Link from "next/link"
import { schoolConfig } from "@/lib/school-config"

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [schoolData, setSchoolData] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const isAuth = await checkAdminAuth()
      if (!isAuth) {
        router.push("/admin")
      } else {
        setIsAuthenticated(true)
        // Fetch school data to check if SMS is enabled
        try {
          const response = await fetch('/api/school/current')
          const data = await response.json()
          setSchoolData(data)
        } catch (error) {
          console.log('[v0] Error fetching school data:', error)
        }
      }
    }
    checkAuth()
  }, [router])

  const handleLogout = () => {
    document.cookie = "admin_auth=; path=/; max-age=0"
    router.push("/admin")
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Verifying admin access...</div>
      </div>
    )
  }

  const navItems = [
    { href: "/admin/dashboard", icon: Home, label: "Overview" },
    { href: "/admin/dashboard/classes", icon: BookOpen, label: "Classes" },
    { href: "/admin/dashboard/learners", icon: Users, label: "Learners" },
    { href: "/admin/dashboard/sessions", icon: ClipboardList, label: "Sessions & Locks" },
    { href: "/admin/dashboard/teacher-accounts", icon: Key, label: "Teacher PIN Accounts" },
    { href: "/admin/dashboard/teacher-assignments", icon: Users, label: "Teacher Assignments" },
    ...(schoolData?.feature_sms ? [{ href: "/admin/dashboard/sms", icon: MessageSquare, label: "SMS" }] : []),
    { href: "/admin/dashboard/settings", icon: Settings, label: "Settings" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <span className="font-bold">Admin Panel</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-white hover:bg-slate-800"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-slate-900 text-white
          transform transition-transform duration-200 ease-in-out
          lg:transform-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-6 border-b border-slate-700 hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Admin Panel</h1>
                <p className="text-xs text-slate-400">{schoolConfig.name}</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
            <Link href="/" className="block mt-2">
              <Button
                variant="outline"
                className="w-full justify-start border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 bg-transparent"
              >
                <Home className="w-5 h-5 mr-3" />
                Back to Main Site
              </Button>
            </Link>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
