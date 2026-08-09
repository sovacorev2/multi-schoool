'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Settings as SettingsIcon, Play, Trash2, Plus, Printer, AlertTriangle, CheckCircle2, CalendarClock,
} from 'lucide-react'
import { TimetableGrid, type TimetableGridCell, type TimetableGridBreak } from '@/components/timetable-grid'
import {
  generateTimetable, computePeriodsPerDay,
  type TimetableClassInput, type TimetableConflict, type TimetableWarning,
} from '@/lib/timetable-generator'
import { generateTimetablePrintHTML, openTimetablePrintWindow } from '@/lib/timetable-print'
import { sortClasses, TERMS } from '../_shared/utils'
import type { Class } from '@/lib/types'

interface SubjectRow {
  id: string
  class_id: string
  name: string
  periods_per_week: number
}

interface TeacherRow {
  id: string
  first_name: string
  last_name: string
  max_periods_per_day: number | null
}

interface AssignmentRow {
  id: string
  user_id: string
  class_id: string
  subject_id: string | null
}

interface BreakRow {
  id: string
  name: string
  after_period_number: number
  duration_minutes: number
}

interface EntryRow {
  id: string
  class_id: string
  subject_id: string
  teacher_id: string | null
  day_of_week: number
  period_number: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 3 }, (_, i) => (CURRENT_YEAR - 1 + i).toString())
const PERIOD_LENGTH_OPTIONS = [30, 35, 40, 45, 60, 80, 90]

export default function TimetablePage() {
  const { currentSchool } = useSchool()

  const [isLoading, setIsLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [breaks, setBreaks] = useState<BreakRow[]>([])

  const [settings, setSettings] = useState({
    school_start_time: '08:00',
    school_end_time: '16:00',
    period_length_minutes: 40,
    days_per_week: 5,
    avoid_consecutive_same_subject: true,
    spread_evenly: true,
  })

  const [newBreakName, setNewBreakName] = useState('')
  const [newBreakAfterPeriod, setNewBreakAfterPeriod] = useState('')
  const [newBreakDuration, setNewBreakDuration] = useState('30')

  const [genTerm, setGenTerm] = useState(TERMS[0])
  const [genYear, setGenYear] = useState(CURRENT_YEAR.toString())
  const [isGenerating, setIsGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{ entryCount: number; conflicts: TimetableConflict[]; warnings: TimetableWarning[] } | null>(null)

  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class')
  const [viewTerm, setViewTerm] = useState(TERMS[0])
  const [viewYear, setViewYear] = useState(CURRENT_YEAR.toString())
  const [viewClassId, setViewClassId] = useState('')
  const [viewTeacherId, setViewTeacherId] = useState('')
  const [viewEntries, setViewEntries] = useState<EntryRow[]>([])
  const [isLoadingView, setIsLoadingView] = useState(false)

  const [editingCell, setEditingCell] = useState<{ day: number; period: number; entry: EntryRow | null } | null>(null)
  const [editSubjectId, setEditSubjectId] = useState('')
  const [editTeacherId, setEditTeacherId] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const periodsPerDay = computePeriodsPerDay(
    settings.school_start_time,
    settings.school_end_time,
    settings.period_length_minutes,
    breaks.map((b) => ({ durationMinutes: b.duration_minutes }))
  )

  const loadAll = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()

    const [classesRes, settingsRes, breaksRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order'),
      supabase.from('timetable_settings').select('*').eq('school_id', currentSchool.id).maybeSingle(),
      supabase.from('timetable_breaks').select('*').eq('school_id', currentSchool.id).order('after_period_number'),
    ])

    const loadedClasses = sortClasses((classesRes.data || []) as Class[])
    setClasses(loadedClasses)
    setBreaks((breaksRes.data || []) as BreakRow[])

    if (settingsRes.data) {
      setSettings({
        school_start_time: settingsRes.data.school_start_time,
        school_end_time: settingsRes.data.school_end_time,
        period_length_minutes: settingsRes.data.period_length_minutes,
        days_per_week: settingsRes.data.days_per_week,
        avoid_consecutive_same_subject: settingsRes.data.avoid_consecutive_same_subject,
        spread_evenly: settingsRes.data.spread_evenly,
      })
    }

    const classIds = loadedClasses.map((c) => c.id)
    const [subjectsRes, teachersRes, assignmentsRes] = await Promise.all([
      classIds.length > 0
        ? supabase.from('subjects').select('id, class_id, name, periods_per_week').in('class_id', classIds)
        : Promise.resolve({ data: [] as SubjectRow[] }),
      supabase.from('teacher_accounts').select('id, first_name, last_name, max_periods_per_day').eq('school_id', currentSchool.id).eq('is_active', true),
      supabase.from('teacher_assignments').select('id, user_id, class_id, subject_id').eq('school_id', currentSchool.id).eq('is_active', true),
    ])
    setSubjects((subjectsRes.data || []) as SubjectRow[])
    setTeachers((teachersRes.data || []) as TeacherRow[])
    setAssignments((assignmentsRes.data || []) as AssignmentRow[])

    setIsLoading(false)
  }, [currentSchool?.id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // --- Settings ---
  const saveSettings = async (patch: Partial<typeof settings>) => {
    if (!currentSchool) return
    const next = { ...settings, ...patch }
    setSettings(next)
    const supabase = createClient()
    const { error } = await supabase
      .from('timetable_settings')
      .upsert({ school_id: currentSchool.id, ...next }, { onConflict: 'school_id' })
    if (error) alert(`Failed to save settings: ${error.message}`)
  }

  const addBreak = async () => {
    if (!currentSchool || !newBreakName.trim() || !newBreakAfterPeriod) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('timetable_breaks')
      .insert({
        school_id: currentSchool.id,
        name: newBreakName.trim(),
        after_period_number: Number(newBreakAfterPeriod),
        duration_minutes: Number(newBreakDuration) || 30,
      })
      .select('*')
      .single()
    if (error) {
      alert(`Failed to add break: ${error.message}`)
      return
    }
    setBreaks((prev) => [...prev, data as BreakRow].sort((a, b) => a.after_period_number - b.after_period_number))
    setNewBreakName('')
    setNewBreakAfterPeriod('')
    setNewBreakDuration('30')
  }

  const deleteBreak = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('timetable_breaks').delete().eq('id', id)
    if (error) {
      alert(`Failed to delete break: ${error.message}`)
      return
    }
    setBreaks((prev) => prev.filter((b) => b.id !== id))
  }

  const updateSubjectPeriods = async (subjectId: string, value: string) => {
    const periods = Math.max(0, Number(value) || 0)
    const supabase = createClient()
    const { error } = await supabase.from('subjects').update({ periods_per_week: periods }).eq('id', subjectId)
    if (error) {
      alert(`Failed to save periods: ${error.message}`)
      return
    }
    setSubjects((prev) => prev.map((s) => (s.id === subjectId ? { ...s, periods_per_week: periods } : s)))
  }

  const updateTeacherMax = async (teacherId: string, value: string) => {
    const max = value === '' ? null : Math.max(0, Number(value) || 0)
    const supabase = createClient()
    const { error } = await supabase.from('teacher_accounts').update({ max_periods_per_day: max }).eq('id', teacherId)
    if (error) {
      alert(`Failed to save limit: ${error.message}`)
      return
    }
    setTeachers((prev) => prev.map((t) => (t.id === teacherId ? { ...t, max_periods_per_day: max } : t)))
  }

  // --- Generation ---
  const resolveTeacherForSubject = (classId: string, subjectId: string): string | null => {
    const specific = assignments.find((a) => a.class_id === classId && a.subject_id === subjectId)
    if (specific) return specific.user_id
    const wholeClass = assignments.find((a) => a.class_id === classId && !a.subject_id)
    return wholeClass ? wholeClass.user_id : null
  }

  const teacherName = (id: string | null) => {
    if (!id) return null
    const t = teachers.find((t) => t.id === id)
    return t ? `${t.first_name} ${t.last_name}` : null
  }

  const handleGenerate = async () => {
    if (!currentSchool) return
    setIsGenerating(true)
    setGenResult(null)

    const classInputs: TimetableClassInput[] = classes.map((cls) => ({
      classId: cls.id,
      className: cls.name,
      subjects: subjects
        .filter((s) => s.class_id === cls.id)
        .map((s) => {
          const teacherId = resolveTeacherForSubject(cls.id, s.id)
          return {
            subjectId: s.id,
            subjectName: s.name,
            periodsPerWeek: s.periods_per_week,
            teacherId,
            teacherName: teacherName(teacherId),
          }
        }),
    }))

    const teacherMaxPerDay = new Map(teachers.map((t) => [t.id, t.max_periods_per_day]))

    const result = generateTimetable(classInputs, teacherMaxPerDay, {
      daysPerWeek: settings.days_per_week,
      periodsPerDay,
      avoidConsecutiveSameSubject: settings.avoid_consecutive_same_subject,
      spreadEvenly: settings.spread_evenly,
    })

    const supabase = createClient()
    await supabase
      .from('timetable_entries')
      .delete()
      .eq('school_id', currentSchool.id)
      .eq('term', genTerm)
      .eq('year', Number(genYear))

    if (result.entries.length > 0) {
      const rows = result.entries.map((e) => ({
        school_id: currentSchool.id,
        class_id: e.classId,
        subject_id: e.subjectId,
        teacher_id: e.teacherId,
        day_of_week: e.dayOfWeek,
        period_number: e.periodNumber,
        term: genTerm,
        year: Number(genYear),
      }))
      const { error } = await supabase.from('timetable_entries').insert(rows)
      if (error) {
        alert(`Failed to save generated timetable: ${error.message}`)
        setIsGenerating(false)
        return
      }
    }

    setGenResult({ entryCount: result.entries.length, conflicts: result.conflicts, warnings: result.warnings })
    setIsGenerating(false)

    // If the View tab is already pointed at this term/year, refresh it.
    if (viewTerm === genTerm && viewYear === genYear) loadViewEntries()
  }

  // --- View ---
  const loadViewEntries = useCallback(async () => {
    if (!currentSchool) return
    if (viewMode === 'class' && !viewClassId) { setViewEntries([]); return }
    if (viewMode === 'teacher' && !viewTeacherId) { setViewEntries([]); return }

    setIsLoadingView(true)
    const supabase = createClient()
    let query = supabase
      .from('timetable_entries')
      .select('*')
      .eq('school_id', currentSchool.id)
      .eq('term', viewTerm)
      .eq('year', Number(viewYear))
    query = viewMode === 'class' ? query.eq('class_id', viewClassId) : query.eq('teacher_id', viewTeacherId)
    const { data } = await query
    setViewEntries((data || []) as EntryRow[])
    setIsLoadingView(false)
  }, [currentSchool?.id, viewMode, viewTerm, viewYear, viewClassId, viewTeacherId])

  useEffect(() => {
    loadViewEntries()
  }, [loadViewEntries])

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name || 'Unknown'
  const className = (id: string) => classes.find((c) => c.id === id)?.name || 'Unknown'

  const gridCells: Record<string, TimetableGridCell> = useMemo(() => {
    const cells: Record<string, TimetableGridCell> = {}
    for (const e of viewEntries) {
      cells[`${e.day_of_week}|${e.period_number}`] = {
        subjectId: e.subject_id,
        subjectName: subjectName(e.subject_id),
        teacherId: e.teacher_id,
        subtitle: viewMode === 'class' ? teacherName(e.teacher_id) : className(e.class_id),
      }
    }
    return cells
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewEntries, viewMode, subjects, classes, teachers])

  const gridBreaks: TimetableGridBreak[] = breaks.map((b) => ({
    name: b.name,
    afterPeriodNumber: b.after_period_number,
    durationMinutes: b.duration_minutes,
  }))

  const handlePrint = () => {
    if (!currentSchool) return
    const title = viewMode === 'class' ? `${className(viewClassId)} - Timetable` : `${teacherName(viewTeacherId) || 'Teacher'} - Timetable`
    const html = generateTimetablePrintHTML({
      title,
      schoolName: currentSchool.name,
      termLabel: `${viewTerm} ${viewYear}`,
      daysPerWeek: settings.days_per_week,
      periodsPerDay,
      breaks: gridBreaks,
      cells: gridCells,
    })
    openTimetablePrintWindow(html)
  }

  // --- Manual edit (class view only - a teacher's schedule is a read-only rollup of their classes) ---
  const openCellEditor = (day: number, period: number) => {
    if (viewMode !== 'class' || !viewClassId) return
    const entry = viewEntries.find((e) => e.day_of_week === day && e.period_number === period) || null
    setEditingCell({ day, period, entry })
    setEditSubjectId(entry?.subject_id || '')
    setEditTeacherId(entry?.teacher_id || '')
  }

  const saveCellEdit = async () => {
    if (!editingCell || !currentSchool || !viewClassId) return
    setIsSavingEdit(true)
    const supabase = createClient()

    if (editingCell.entry) {
      await supabase.from('timetable_entries').delete().eq('id', editingCell.entry.id)
    }

    if (editSubjectId) {
      const teacherId = editTeacherId || null
      if (teacherId) {
        const { data: clash } = await supabase
          .from('timetable_entries')
          .select('id, class_id')
          .eq('school_id', currentSchool.id)
          .eq('term', viewTerm)
          .eq('year', Number(viewYear))
          .eq('teacher_id', teacherId)
          .eq('day_of_week', editingCell.day)
          .eq('period_number', editingCell.period)
          .maybeSingle()
        if (clash && clash.class_id !== viewClassId) {
          const proceed = confirm(
            `${teacherName(teacherId)} is already teaching ${className(clash.class_id)} at this time. Moving them here will unassign them from that slot. Continue?`
          )
          if (!proceed) {
            setIsSavingEdit(false)
            return
          }
          await supabase.from('timetable_entries').delete().eq('id', clash.id)
        }
      }

      const { error } = await supabase.from('timetable_entries').insert({
        school_id: currentSchool.id,
        class_id: viewClassId,
        subject_id: editSubjectId,
        teacher_id: teacherId,
        day_of_week: editingCell.day,
        period_number: editingCell.period,
        term: viewTerm,
        year: Number(viewYear),
      })
      if (error) {
        alert(`Failed to save: ${error.message}`)
        setIsSavingEdit(false)
        return
      }
    }

    setEditingCell(null)
    setIsSavingEdit(false)
    loadViewEntries()
  }

  const editingClassSubjects = subjects.filter((s) => s.class_id === viewClassId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarClock className="w-6 h-6" />
          Timetable
        </h1>
        <p className="text-gray-500">Generate a conflict-free weekly timetable for every class, or view and adjust one manually.</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="view">View &amp; Edit</TabsTrigger>
        </TabsList>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SettingsIcon className="w-4 h-4" /> School Hours &amp; Days</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>School Start Time</Label>
                <Input type="time" value={settings.school_start_time} onChange={(e) => saveSettings({ school_start_time: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>School End Time</Label>
                <Input type="time" value={settings.school_end_time} onChange={(e) => saveSettings({ school_end_time: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Period Length</Label>
                <Select value={settings.period_length_minutes.toString()} onValueChange={(v) => saveSettings({ period_length_minutes: Number(v) })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_LENGTH_OPTIONS.map((m) => <SelectItem key={m} value={m.toString()}>{m} minutes</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>School Days</Label>
                <Select value={settings.days_per_week.toString()} onValueChange={(v) => saveSettings({ days_per_week: Number(v) })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Monday - Friday (5 days)</SelectItem>
                    <SelectItem value="6">Monday - Saturday (6 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 text-xs text-gray-500">
                {periodsPerDay} teaching periods fit per day with the current settings and breaks.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Breaks</CardTitle>
              <CardDescription>Add every break in the school day (morning break, lunch, etc.)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {breaks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <span>{b.name} - after period {b.after_period_number}, {b.duration_minutes} min</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteBreak(b.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 items-end pt-2 border-t">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={newBreakName} onChange={(e) => setNewBreakName(e.target.value)} placeholder="Lunch" className="h-9 w-32" />
                </div>
                <div>
                  <Label className="text-xs">After Period</Label>
                  <Input type="number" min="1" value={newBreakAfterPeriod} onChange={(e) => setNewBreakAfterPeriod(e.target.value)} className="h-9 w-24" />
                </div>
                <div>
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" min="1" value={newBreakDuration} onChange={(e) => setNewBreakDuration(e.target.value)} className="h-9 w-24" />
                </div>
                <Button size="sm" onClick={addBreak}><Plus className="w-4 h-4 mr-1" /> Add Break</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generation Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.avoid_consecutive_same_subject} onChange={(e) => saveSettings({ avoid_consecutive_same_subject: e.target.checked })} />
                Avoid consecutive same-subject periods (recommended)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.spread_evenly} onChange={(e) => saveSettings({ spread_evenly: e.target.checked })} />
                Spread periods evenly across the week (recommended)
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Periods per Week, by Class and Subject</CardTitle>
              <CardDescription>How many periods each subject needs, per week, in each class.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {classes.map((cls) => {
                const clsSubjects = subjects.filter((s) => s.class_id === cls.id)
                if (clsSubjects.length === 0) return null
                return (
                  <div key={cls.id}>
                    <p className="font-medium text-sm mb-1">{cls.name}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {clsSubjects.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 p-2 border rounded text-xs">
                          <span className="truncate">{s.name}</span>
                          <Input
                            type="number"
                            min="0"
                            defaultValue={s.periods_per_week}
                            onBlur={(e) => updateSubjectPeriods(s.id, e.target.value)}
                            className="h-7 w-14 text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Max Periods per Day, by Teacher</CardTitle>
              <CardDescription>Leave blank for no limit.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {teachers.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 p-2 border rounded text-xs">
                  <span className="truncate">{t.first_name} {t.last_name}</span>
                  <Input
                    type="number"
                    min="0"
                    defaultValue={t.max_periods_per_day ?? ''}
                    placeholder="None"
                    onBlur={(e) => updateTeacherMax(t.id, e.target.value)}
                    className="h-7 w-14 text-center"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GENERATE */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Timetable</CardTitle>
              <CardDescription>Builds a fresh timetable for every class for the selected term, replacing any timetable already generated for it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Select value={genTerm} onValueChange={setGenTerm}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={genYear} onValueChange={setGenYear}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={handleGenerate} disabled={isGenerating || classes.length === 0}>
                  <Play className="w-4 h-4 mr-1" /> {isGenerating ? 'Generating...' : 'Generate Timetable'}
                </Button>
              </div>

              {classes.length === 0 && <p className="text-sm text-gray-500">No classes found for this school yet.</p>}

              {genResult && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Placed {genResult.entryCount} periods across {classes.length} classes.
                  </div>

                  {genResult.conflicts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-700 flex items-center gap-1 mb-1"><AlertTriangle className="w-4 h-4" /> {genResult.conflicts.length} conflict(s) - needs manual placement</p>
                      <div className="space-y-1">
                        {genResult.conflicts.map((c, i) => (
                          <div key={i} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                            <span className="font-medium">{c.className} - {c.subjectName}:</span> {c.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {genResult.warnings.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-700 flex items-center gap-1 mb-1"><AlertTriangle className="w-4 h-4" /> {genResult.warnings.length} warning(s)</p>
                      <div className="space-y-1">
                        {genResult.warnings.map((w, i) => (
                          <div key={i} className="text-xs bg-amber-50 border border-amber-200 rounded p-2">{w.message}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VIEW & EDIT */}
        <TabsContent value="view" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'class' | 'teacher')}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">By Class</SelectItem>
                    <SelectItem value="teacher">By Teacher</SelectItem>
                  </SelectContent>
                </Select>

                {viewMode === 'class' ? (
                  <Select value={viewClassId} onValueChange={setViewClassId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Select value={viewTeacherId} onValueChange={setViewTeacherId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Choose a teacher" /></SelectTrigger>
                    <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                )}

                <Select value={viewTerm} onValueChange={setViewTerm}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={viewYear} onValueChange={setViewYear}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>

                <Button size="sm" variant="outline" onClick={handlePrint} disabled={Object.keys(gridCells).length === 0}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
              </div>

              {isLoadingView ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : Object.keys(gridCells).length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  {(viewMode === 'class' && !viewClassId) || (viewMode === 'teacher' && !viewTeacherId)
                    ? 'Pick a class or teacher above to see their timetable.'
                    : 'No timetable generated yet for this term. Generate one from the Generate tab.'}
                </p>
              ) : (
                <TimetableGrid
                  daysPerWeek={settings.days_per_week}
                  periodsPerDay={periodsPerDay}
                  breaks={gridBreaks}
                  cells={gridCells}
                  onCellClick={viewMode === 'class' ? openCellEditor : undefined}
                />
              )}
              {viewMode === 'class' && viewClassId && <p className="text-xs text-gray-400">Click any cell to manually adjust it.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingCell} onOpenChange={(open) => { if (!open) setEditingCell(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Period</DialogTitle>
            <DialogDescription>
              {editingCell && `${className(viewClassId)} - Day ${editingCell.day}, Period ${editingCell.period}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Select value={editSubjectId || 'none'} onValueChange={(v) => { setEditSubjectId(v === 'none' ? '' : v); setEditTeacherId('') }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="No subject (leave empty)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject (leave empty)</SelectItem>
                  {editingClassSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editSubjectId && (
              <div>
                <Label>Teacher</Label>
                <Select value={editTeacherId || 'none'} onValueChange={(v) => setEditTeacherId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No teacher" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No teacher</SelectItem>
                    {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCell(null)}>Cancel</Button>
            <Button onClick={saveCellEdit} disabled={isSavingEdit}>{isSavingEdit ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
