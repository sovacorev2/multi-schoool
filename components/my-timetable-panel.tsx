'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CalendarClock, Printer } from 'lucide-react'
import { TimetableGrid, type TimetableGridCell } from '@/components/timetable-grid'
import { resolveCategoryGrid, buildMergedColumns, mergedColumnKeyFor, type ResolvedCategoryGrid, type CategorySettingsRow, type CategoryBreakRow } from '@/lib/timetable-merged-view'
import { generateTimetablePrintHTML, openTimetablePrintWindow } from '@/lib/timetable-print'
import { getCategoryForClass } from '@/lib/cbc-categories'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 3 }, (_, i) => (CURRENT_YEAR - 1 + i).toString())
const TERMS = ['Term 1', 'Term 2', 'Term 3']

const FALLBACK_SETTINGS: CategorySettingsRow = {
  school_start_time: '08:00', school_end_time: '16:00', period_length_minutes: 40, days_per_week: 5,
  avoid_consecutive_same_subject: true, spread_evenly: true,
}

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
 *
 * Settings/breaks are per CBC level now, not one shared school-wide row - a
 * teacher who only teaches within one level (the common case) sees a normal
 * grid; a teacher spanning levels with different daily structures (a
 * specialist, a head teacher covering lessons) sees a merged, real-clock-time
 * grid instead, since period numbers alone don't line up across levels.
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
  const [settingsByCategory, setSettingsByCategory] = useState<Record<string, CategorySettingsRow>>({})
  const [breaksByCategory, setBreaksByCategory] = useState<Record<string, CategoryBreakRow[]>>({})
  const [categoryByClassId, setCategoryByClassId] = useState<Record<string, string>>({})
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
        supabase.from('timetable_settings').select('category, school_start_time, school_end_time, period_length_minutes, days_per_week, avoid_consecutive_same_subject, spread_evenly').eq('school_id', schoolId),
        supabase.from('timetable_breaks').select('category, name, after_period_number, duration_minutes').eq('school_id', schoolId).order('after_period_number'),
        supabase.from('classes').select('id, name').eq('school_id', schoolId),
      ])
      const classRows = (classesRes.data || []) as { id: string; name: string }[]
      const classIds = classRows.map((c) => c.id)
      const subjectsRes = classIds.length > 0
        ? await supabase.from('subjects').select('id, name, class_id').in('class_id', classIds)
        : { data: [] as { id: string; name: string }[] }
      if (cancelled) return

      const settingsRows = (settingsRes.data || []) as (CategorySettingsRow & { category: string | null })[]
      const nextSettings: Record<string, CategorySettingsRow> = {}
      for (const row of settingsRows) {
        if (row.category) nextSettings[row.category] = row
      }
      setSettingsByCategory(nextSettings)

      const breaksRows = (breaksRes.data || []) as (CategoryBreakRow & { category: string | null })[]
      const nextBreaks: Record<string, CategoryBreakRow[]> = {}
      for (const row of breaksRows) {
        if (!row.category) continue
        if (!nextBreaks[row.category]) nextBreaks[row.category] = []
        nextBreaks[row.category].push(row)
      }
      setBreaksByCategory(nextBreaks)

      setCategoryByClassId(Object.fromEntries(classRows.map((c) => [c.id, getCategoryForClass(c.name) || 'General'])))
      setClassNames(Object.fromEntries(classRows.map((c) => [c.id, c.name])))
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

  const categoryForClass = (classId: string) => categoryByClassId[classId] || 'General'

  const involvedCategories = useMemo(() => {
    const cats = new Set(entries.map((e) => categoryForClass(e.class_id)))
    return [...cats]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, categoryByClassId])

  const isMergedView = involvedCategories.length > 1

  const grids = useMemo(() => {
    const map = new Map<string, ResolvedCategoryGrid>()
    for (const cat of involvedCategories) {
      map.set(cat, resolveCategoryGrid(cat, settingsByCategory[cat] || FALLBACK_SETTINGS, breaksByCategory[cat] || []))
    }
    return map
  }, [involvedCategories, settingsByCategory, breaksByCategory])

  const primaryGrid = grids.get(involvedCategories[0])
  const mergedColumns = useMemo(() => (isMergedView ? buildMergedColumns([...grids.values()]) : null), [isMergedView, grids])

  const gridBreaks = (breaksByCategory[involvedCategories[0]] || []).map((b) => ({
    name: b.name, afterPeriodNumber: b.after_period_number, durationMinutes: b.duration_minutes,
  }))
  const daysPerWeek = isMergedView ? Math.max(5, ...[...grids.values()].map((g) => g.daysPerWeek)) : (primaryGrid?.daysPerWeek || 5)

  const gridCells: Record<string, TimetableGridCell> = useMemo(() => {
    const cells: Record<string, TimetableGridCell> = {}
    for (const e of entries) {
      let columnKey: string
      if (isMergedView) {
        const grid = grids.get(categoryForClass(e.class_id))
        const key = grid ? mergedColumnKeyFor(grid, e.period_number) : null
        if (!key) continue
        columnKey = key
      } else {
        columnKey = String(e.period_number)
      }
      cells[`${e.day_of_week}|${columnKey}`] = {
        subjectId: e.subject_id,
        subjectName: subjectNames[e.subject_id] || 'Unknown',
        teacherId,
        subtitle: classNames[e.class_id] || 'Unknown class',
      }
    }
    return cells
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, isMergedView, grids, subjectNames, classNames, teacherId])

  const handlePrint = () => {
    const html = isMergedView && mergedColumns
      ? generateTimetablePrintHTML({
          title: 'My Timetable',
          schoolName,
          termLabel: `${term} ${year}`,
          daysPerWeek,
          columns: mergedColumns.map((c) => ({ key: c.key, label: c.label, subLabel: `- ${c.subLabel}` })),
          cells: gridCells,
        })
      : generateTimetablePrintHTML({
          title: 'My Timetable',
          schoolName,
          termLabel: `${term} ${year}`,
          daysPerWeek,
          periodsPerDay: primaryGrid?.periodsPerDay || 0,
          breaks: gridBreaks,
          periodTimes: primaryGrid?.periodTimes || [],
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
        {isMergedView && (
          <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-3 py-2 mb-3">
            Your classes span more than one level ({involvedCategories.join(', ')}), which run on different daily schedules - showing a merged view by real time instead of period number.
          </p>
        )}
        {isLoadingEntries ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : Object.keys(gridCells).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No timetable has been generated for {term} {year} yet. Check back once your school admin generates it.
          </p>
        ) : isMergedView && mergedColumns ? (
          <TimetableGrid
            daysPerWeek={daysPerWeek}
            columns={mergedColumns.map((c) => ({ key: c.key, label: c.label, subLabel: `- ${c.subLabel}` }))}
            cells={gridCells}
          />
        ) : (
          <TimetableGrid
            daysPerWeek={daysPerWeek}
            periodsPerDay={primaryGrid?.periodsPerDay || 0}
            breaks={gridBreaks}
            periodTimes={primaryGrid?.periodTimes || []}
            cells={gridCells}
          />
        )}
      </CardContent>
    </Card>
  )
}
