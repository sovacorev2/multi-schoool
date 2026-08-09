'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

/**
 * Self-contained "my weekly timetable" view: term/year picker, grid, print
 * button. Shared by app/dashboard/my-timetable (reached after picking a
 * class) and app/teacher/dashboard (the landing page right after PIN login,
 * before any class is picked) so a teacher can see their schedule either way.
 */
export function MyTimetablePanel({
  schoolId,
  schoolName,
  teacherId,
}: {
  schoolId: string
  schoolName: string
  teacherId: string
}) {
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
    if (!schoolId) return
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      const supabase = createClient()
      const [settingsRes, breaksRes, classesRes] = await Promise.all([
        supabase.from('timetable_settings').select('days_per_week, school_start_time, school_end_time, period_length_minutes').eq('school_id', schoolId).maybeSingle(),
        supabase.from('timetable_breaks').select('id, name, after_period_number, duration_minutes').eq('school_id', schoolId).order('after_period_number'),
        supabase.from('classes').select('id, name').eq('school_id', schoolId),
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
  }, [schoolId])

  useEffect(() => {
    if (!schoolId || !teacherId) return
    let cancelled = false
    ;(async () => {
      setIsLoadingEntries(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('timetable_entries')
        .select('id, class_id, subject_id, day_of_week, period_number')
        .eq('school_id', schoolId)
        .eq('teacher_id', teacherId)
        .eq('term', term)
        .eq('year', Number(year))
      if (cancelled) return
      setEntries((data || []) as EntryRow[])
      setIsLoadingEntries(false)
    })()
    return () => { cancelled = true }
  }, [schoolId, teacherId, term, year])

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
    if (!settings) return
    const html = generateTimetablePrintHTML({
      title: 'My Timetable',
      schoolName,
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
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="w-5 h-5" />
          My Timetable
        </CardTitle>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={Object.keys(gridCells).length === 0}>
            <Printer className="w-4 h-4 mr-1" /> Print / Download
          </Button>
        </div>
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
  )
}
