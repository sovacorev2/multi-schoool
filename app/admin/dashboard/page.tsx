"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  BookOpen, 
  ClipboardList, 
  Lock,
  Unlock,
  TrendingUp,
  Calendar,
  Key,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import { schoolConfig } from "@/lib/school-config"
import { useSchool } from "@/lib/school-context"

interface Stats {
  totalClasses: number
  totalLearners: number
  totalSessions: number
  lockedSessions: number
  unlockedSessions: number
  recentActivity: { action: string; details: string; created_at: string }[]
  teacherAccounts?: number
}

export default function AdminOverviewPage() {
  const { currentSchool } = useSchool()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pinLoginEnabled, setPinLoginEnabled] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient()
        
        // Check if PIN login is enabled for this school
        if (currentSchool) {
          setPinLoginEnabled((currentSchool as any)?.enable_pin_login === true)
        }
        
        const [classesRes, learnersRes, sessionsRes, logsRes, teachersRes] = await Promise.all([
          supabase.from("classes").select("id", { count: "exact" }),
          supabase.from("learners").select("id", { count: "exact" }),
          supabase.from("sessions").select("*"),
          supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(5),
          currentSchool?.id ? supabase.from("teacher_accounts").select("id", { count: "exact" }).eq('school_id', currentSchool.id) : Promise.resolve({ count: 0 })
        ])

        const sessions = sessionsRes.data || []
        
        setStats({
          totalClasses: classesRes.count || 0,
          totalLearners: learnersRes.count || 0,
          totalSessions: sessions.length,
          lockedSessions: sessions.filter(s => s.is_locked).length,
          unlockedSessions: sessions.filter(s => !s.is_locked).length,
          recentActivity: logsRes.data || [],
          teacherAccounts: teachersRes.count || 0
        })
      } catch (err) {
        console.error("Failed to fetch stats:", err)
        setError(err instanceof Error ? err.message : "Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [currentSchool])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Dashboard</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Please check your Supabase configuration and try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-600">Welcome to the {schoolConfig.name} Admin Panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Classes</CardTitle>
            <BookOpen className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalClasses}</div>
            <p className="text-xs text-gray-500 mt-1">Active classes in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Learners</CardTitle>
            <Users className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalLearners}</div>
            <p className="text-xs text-gray-500 mt-1">Registered learners</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Open Sessions</CardTitle>
            <Unlock className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.unlockedSessions}</div>
            <p className="text-xs text-gray-500 mt-1">Sessions accepting marks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Locked Sessions</CardTitle>
            <Lock className="w-5 h-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.lockedSessions}</div>
            <p className="text-xs text-gray-500 mt-1">Completed sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* PIN Login Management Card */}
      <Card className={pinLoginEnabled ? "border-green-200 bg-green-50" : "border-gray-200"}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Key className={pinLoginEnabled ? "w-5 h-5 text-green-600" : "w-5 h-5 text-gray-400"} />
            <div>
              <CardTitle className="text-lg">Teacher PIN Login System</CardTitle>
              <CardDescription>
                {pinLoginEnabled ? "PIN-based teacher authentication enabled for your school" : "Feature not yet enabled"}
              </CardDescription>
            </div>
          </div>
          {pinLoginEnabled && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          {!pinLoginEnabled && <AlertCircle className="w-5 h-5 text-gray-400" />}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pinLoginEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Teacher Accounts Created</p>
                    <p className="text-2xl font-bold text-green-600">{stats?.teacherAccounts || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Feature Status</p>
                    <Badge className="bg-green-600 text-white mt-2">Active</Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-700 bg-white p-3 rounded border border-green-100">
                  ✓ Teachers can login with PIN + Welcome Password
                  <br />
                  ✓ Access control per class and subject
                  <br />
                  ✓ Automatic teacher comments on marks
                </p>
                <div className="flex gap-2">
                  <Link href="/admin/dashboard/teacher-accounts">
                    <Button className="gap-2" variant="default">
                      <Key className="w-4 h-4" />
                      Manage Teacher Accounts
                    </Button>
                  </Link>
                  <Link href="/admin/dashboard/teacher-assignments">
                    <Button className="gap-2" variant="outline">
                      <Users className="w-4 h-4" />
                      Manage Assignments
                    </Button>
                  </Link>
                </div>
              </>
            )}
            {!pinLoginEnabled && (
              <p className="text-sm text-gray-700">
                The PIN-based teacher login system is currently available as a pilot feature for selected schools. Please contact support to enable this feature for your school.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest actions in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {stats?.recentActivity.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <Badge variant="outline" className="mr-2">{log.action.replace(/_/g, ' ')}</Badge>
                    <span className="text-sm text-gray-600">{log.details}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5" />
              Current Term Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Year:</span>
                <span className="font-medium">{new Date().getFullYear()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sessions:</span>
                <span className="font-medium">{stats?.totalSessions}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="w-5 h-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Database:</span>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Authentication:</span>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
