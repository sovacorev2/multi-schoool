'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { getStoredTeacherId } from '@/lib/teacher-permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CalendarClock, Printer } from 'lucide-react'
import { TimetableGrid, type TimetableGridCell, type TimetableGridBreak } from '@/components/timetable-grid'
import { computePeriodsPerDay, computePeriodTimes } from '@/lib/timetable-generator'
import { generateTimetablePrintHTML, openTimetablePrintWindow } from '@/lib/timetable-print'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 3 }, (_, i) => (CURRENT_YEAR - 1 + i).toString())
const TERMS = ['Term 1', 'Term 2', 'Term 3']

interface EntryRow {
  id: string
  class_id: string
  subject_id: string
  day_of_week: number
  period_number: number
}

export default function MyTimetablePage() {
  const { currentSchool } = useSchool()
  const teacherId = getStoredTeacherId()

  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState<{ days_per_week: number; school_start_time: string; school_end_time: string; period_length_minutes: number } | null>(null)
  const [breaks, setBreaks] = useState<{ id: string; name: string; after_period_number: number; duration_minutes: number }[]>([])
  const [classNames, setClassNames] = useState<Record<string, string>>({})
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({})

  const [term, setTerm] = useState(TERMS[0])
  const [year, setYear] = useState(CURRENT_YEAR.toString())
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)

  useEffect(() => {
    if (!currentSchool) return
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      const supabase = createClient()
      const [settingsRes, breaksRes, classesRes] = await Promise.all([
        supabase.from('timetable_settings').select('days_per_week, school_start_time, school_end_time, period_length_minutes').eq('school_id', currentSchool.id).maybeSingle(),
        supabase.from('timetable_breaks').select('id, name, after_period_number, duration_minutes').eq('school_id', currentSchool.id).order('after_period_number'),
        supabase.from('classes').select('id, name').eq('school_id', currentSchool.id),
      ])
      const classIds = (classesRes.data || []).map((c: { id: string }) => c.id)
      const subjectsRes = classIds.length > 0
        ? await supabase.from('subjects').select('id, name, class_id').in('class_id', classIds)
        : { data: [] as { id: string; name: string }[] }
      if (cancelled) return

      setSettings(settingsRes.data || { days_per_week: 5, school_start_time: '08:00', school_end_time: '16:00', period_length_minutes: 40 })
      setBreaks(breaksRes.data || [])
      setClassNames(Object.fromEntries((classesRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name])))
      setSubjectNames(Object.fromEntries((subjectsRes.data || []).map((s: { id: string; name: string }) => [s.id, s.name])))
      setIsLoading(false)
    })()
    return () => { cancelled = true }
  }, [currentSchool?.id])

  useEffect(() => {
    if (!currentSchool || !teacherId) return
    let cancelled = false
    ;(async () => {
      setIsLoadingEntries(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('timetable_entries')
        .select('id, class_id, subject_id, day_of_week, period_number')
        .eq('school_id', currentSchool.id)
        .eq('teacher_id', teacherId)
        .eq('term', term)
        .eq('year', Number(year))
      if (cancelled) return
      setEntries((data || []) as EntryRow[])
      setIsLoadingEntries(false)
    })()
    return () => { cancelled = true }
  }, [currentSchool?.id, teacherId, term, year])

  const periodsPerDay = settings
    ? computePeriodsPerDay(settings.school_start_time, settings.school_end_time, settings.period_length_minutes, breaks.map((b) => ({ durationMinutes: b.duration_minutes })))
    : 0
  const periodTimes = settings
    ? computePeriodTimes(settings.school_start_time, settings.period_length_minutes, periodsPerDay, breaks.map((b) => ({ afterPeriodNumber: b.after_period_number, durationMinutes: b.duration_minutes })))
    : []

  const gridBreaks: TimetableGridBreak[] = breaks.map((b) => ({ name: b.name, afterPeriodNumber: b.after_period_number, durationMinutes: b.duration_minutes }))

  const gridCells: Record<string, TimetableGridCell> = useMemo(() => {
    const cells: Record<string, TimetableGridCell> = {}
    for (const e of entries) {
      cells[`${e.day_of_week}|${e.period_number}`] = {
        subjectId: e.subject_id,
        subjectName: subjectNames[e.subject_id] || 'Unknown',
        teacherId,
        subtitle: classNames[e.class_id] || 'Unknown class',
      }
    }
    return cells
  }, [entries, subjectNames, classNames, teacherId])

  const handlePrint = () => {
    if (!currentSchool || !settings) return
    const html = generateTimetablePrintHTML({
      title: 'My Timetable',
      schoolName: currentSchool.name,
      termLabel: `${term} ${year}`,
      daysPerWeek: settings.days_per_week,
      periodsPerDay,
      breaks: gridBreaks,
      periodTimes,
      cells: gridCells,
    })
    openTimetablePrintWindow(html)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!teacherId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          My Timetable is for teachers logged in via PIN to view their own weekly schedule. Admins can view any class or teacher's timetable from the admin portal's Timetable section.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarClock className="w-6 h-6" />
          My Timetable
        </h1>
        <p className="text-muted-foreground">Your weekly schedule across every class you teach.</p>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
          <div className="flex gap-2">
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={Object.keys(gridCells).length === 0}>
            <Printer className="w-4 h-4 mr-1" /> Print / Download
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingEntries ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : Object.keys(gridCells).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No timetable has been generated for {term} {year} yet. Check back once your school admin generates it.
            </p>
          ) : (
            <TimetableGrid daysPerWeek={settings?.days_per_week || 5} periodsPerDay={periodsPerDay} breaks={gridBreaks} periodTimes={periodTimes} cells={gridCells} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
