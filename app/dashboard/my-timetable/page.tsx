'use client'

export const dynamic = 'force-dynamic'

import { useSchool } from '@/lib/school-context'
import { getStoredTeacherId } from '@/lib/teacher-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { MyTimetablePanel } from '@/components/my-timetable-panel'

export default function MyTimetablePage() {
  const { currentSchool } = useSchool()
  const teacherId = getStoredTeacherId()

  if (!teacherId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          My Timetable is for teachers logged in via PIN to view their own weekly schedule. Admins can view any class or teacher's timetable from the admin portal's Timetable section.
        </CardContent>
      </Card>
    )
  }

  if (!currentSchool) return null

  // Defense in depth - the nav link is already hidden when this isn't
  // enabled, but the route itself is still reachable directly by URL.
  if (!currentSchool.feature_timetabling) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Timetabling isn't enabled for this school yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Timetable</h1>
        <p className="text-muted-foreground">Your weekly schedule across every class you teach.</p>
      </div>
      <MyTimetablePanel schoolId={currentSchool.id} schoolName={currentSchool.name} teacherId={teacherId} />
    </div>
  )
}
