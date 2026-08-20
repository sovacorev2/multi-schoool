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
  Settings as SettingsIcon, Play, Trash2, Plus, Printer, AlertTriangle, CheckCircle2, CalendarClock, Copy, ArrowLeftRight, Sparkles,
} from 'lucide-react'
import { TimetableGrid, type TimetableGridCell } from '@/components/timetable-grid'
import {
  generateTimetable,
  type TimetableClassInput, type TimetableConflict, type TimetableWarning,
} from '@/lib/timetable-generator'
import { resolveCategoryGrid, buildMergedColumns, mergedColumnKeyFor, computeTeacherInitials, type ResolvedCategoryGrid } from '@/lib/timetable-merged-view'
import { generateTimetablePrintHTML, generateBlockTimetablePrintHTML, openTimetablePrintWindow, type BlockTimetableRow } from '@/lib/timetable-print'
import { CBC_CATEGORIES, getCategoryForClass } from '@/lib/cbc-categories'
import { fetchAllRows } from '@/lib/fetch-all-rows'
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
  category: string
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

interface SettingsShape {
  school_start_time: string
  school_end_time: string
  period_length_minutes: number
  days_per_week: number
  avoid_consecutive_same_subject: boolean
  spread_evenly: boolean
  enable_double_lessons: boolean
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 3 }, (_, i) => (CURRENT_YEAR - 1 + i).toString())
const PERIOD_LENGTH_OPTIONS = [30, 35, 40, 45, 60, 80, 90]

// A preschooler's day looks nothing like a JSS learner's - shorter, earlier-
// ending, shorter periods. Sensible starting points per level, not rules;
// every field here is editable per school in the Settings tab.
const DEFAULT_SETTINGS_BY_CATEGORY: Record<string, SettingsShape> = {
  'Pre-School': { school_start_time: '08:00', school_end_time: '13:00', period_length_minutes: 30, days_per_week: 5, avoid_consecutive_same_subject: true, spread_evenly: true, enable_double_lessons: false },
  'Lower Primary': { school_start_time: '08:00', school_end_time: '15:00', period_length_minutes: 35, days_per_week: 5, avoid_consecutive_same_subject: true, spread_evenly: true, enable_double_lessons: false },
  'Upper Primary': { school_start_time: '08:00', school_end_time: '16:00', period_length_minutes: 40, days_per_week: 5, avoid_consecutive_same_subject: true, spread_evenly: true, enable_double_lessons: false },
  'Junior Secondary': { school_start_time: '08:00', school_end_time: '16:30', period_length_minutes: 40, days_per_week: 5, avoid_consecutive_same_subject: true, spread_evenly: true, enable_double_lessons: true },
}
const FALLBACK_DEFAULT_SETTINGS: SettingsShape = { school_start_time: '08:00', school_end_time: '16:00', period_length_minutes: 40, days_per_week: 5, avoid_consecutive_same_subject: true, spread_evenly: true, enable_double_lessons: false }

function getDefaultSettingsForCategory(category: string): SettingsShape {
  return DEFAULT_SETTINGS_BY_CATEGORY[category] || FALLBACK_DEFAULT_SETTINGS
}

function effectiveCategory(cls: { name: string }): string {
  return getCategoryForClass(cls.name) || 'General'
}

const CATEGORY_ORDER = [...CBC_CATEGORIES.map((c) => c.name), 'General']
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Lower levels have one generalist class teacher who covers every subject;
// Upper Primary/JSS/General are subject-specialist levels where "class
// teacher" is a pastoral/admin role, not a claim they teach every subject -
// a whole-class (subject_id IS NULL) assignment only implies subject
// coverage for the levels where that's actually how teaching works.
const CATEGORIES_WITH_CLASS_TEACHER_FALLBACK = new Set(['Pre-School', 'Lower Primary'])

export default function TimetablePage() {
  const { currentSchool } = useSchool()

  const [isLoading, setIsLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])

  const [settingsByCategory, setSettingsByCategory] = useState<Record<string, SettingsShape>>({})
  const [breaksByCategory, setBreaksByCategory] = useState<Record<string, BreakRow[]>>({})
  const [configuredCategories, setConfiguredCategories] = useState<Set<string>>(new Set())
  const [settingsCategoryTab, setSettingsCategoryTab] = useState('')
  const [copyFromCategory, setCopyFromCategory] = useState('')

  const [newBreakName, setNewBreakName] = useState('')
  const [newBreakAfterPeriod, setNewBreakAfterPeriod] = useState('')
  const [newBreakDuration, setNewBreakDuration] = useState('30')

  const [genTerm, setGenTerm] = useState(TERMS[0])
  const [genYear, setGenYear] = useState(CURRENT_YEAR.toString())
  const [isGenerating, setIsGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{ entryCount: number; conflicts: TimetableConflict[]; warnings: TimetableWarning[]; levelWarnings: string[] } | null>(null)

  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class')
  const [viewTerm, setViewTerm] = useState(TERMS[0])
  const [viewYear, setViewYear] = useState(CURRENT_YEAR.toString())
  const [viewClassId, setViewClassId] = useState('')
  const [viewTeacherId, setViewTeacherId] = useState('')
  const [viewEntries, setViewEntries] = useState<EntryRow[]>([])
  const [isLoadingView, setIsLoadingView] = useState(false)
  // Every entry in the school for the current term/year, regardless of which
  // class/teacher the grid is currently showing - powers cross-class teacher
  // availability checks and suggestions without a query per dialog open.
  const [allTermEntries, setAllTermEntries] = useState<EntryRow[]>([])

  const [editingCell, setEditingCell] = useState<{ day: number; period: number; entry: EntryRow | null } | null>(null)
  const [editSubjectId, setEditSubjectId] = useState('')
  const [editTeacherId, setEditTeacherId] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showCustomSubjectInput, setShowCustomSubjectInput] = useState(false)
  const [customSubjectName, setCustomSubjectName] = useState('')
  const [isAddingCustomSubject, setIsAddingCustomSubject] = useState(false)

  const [swapMode, setSwapMode] = useState(false)
  const [swapSelection, setSwapSelection] = useState<{ day: number; period: number; entry: EntryRow | null } | null>(null)

  const [blockDay, setBlockDay] = useState<number | 'all'>(1)

  const presentCategories = useMemo(() => {
    const set = new Set(classes.map(effectiveCategory))
    return CATEGORY_ORDER.filter((c) => set.has(c))
  }, [classes])

  const loadAll = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()

    const [classesRes, settingsRes, breaksRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order'),
      supabase.from('timetable_settings').select('*').eq('school_id', currentSchool.id),
      supabase.from('timetable_breaks').select('*').eq('school_id', currentSchool.id).order('after_period_number'),
    ])

    const loadedClasses = sortClasses((classesRes.data || []) as Class[])
    setClasses(loadedClasses)

    const loadedCategories = CATEGORY_ORDER.filter((c) => loadedClasses.some((cls) => effectiveCategory(cls) === c))
    const settingsRows = (settingsRes.data || []) as (SettingsShape & { category: string | null })[]
    const breaksRows = (breaksRes.data || []) as BreakRow[]

    const nextSettings: Record<string, SettingsShape> = {}
    const nextConfigured = new Set<string>()
    for (const cat of loadedCategories) {
      const row = settingsRows.find((r) => r.category === cat)
      if (row) {
        nextSettings[cat] = {
          school_start_time: row.school_start_time,
          school_end_time: row.school_end_time,
          period_length_minutes: row.period_length_minutes,
          days_per_week: row.days_per_week,
          avoid_consecutive_same_subject: row.avoid_consecutive_same_subject,
          spread_evenly: row.spread_evenly,
          enable_double_lessons: row.enable_double_lessons,
        }
        nextConfigured.add(cat)
      } else {
        nextSettings[cat] = getDefaultSettingsForCategory(cat)
      }
    }
    setSettingsByCategory(nextSettings)
    setConfiguredCategories(nextConfigured)

    const nextBreaks: Record<string, BreakRow[]> = {}
    for (const cat of loadedCategories) {
      nextBreaks[cat] = breaksRows.filter((b) => b.category === cat)
    }
    setBreaksByCategory(nextBreaks)

    setSettingsCategoryTab((prev) => (prev && loadedCategories.includes(prev) ? prev : loadedCategories[0] || ''))

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

  // --- Settings (per CBC level) ---
  const saveSettings = async (category: string, patch: Partial<SettingsShape>) => {
    if (!currentSchool || !category) return
    const current = settingsByCategory[category] || getDefaultSettingsForCategory(category)
    const next = { ...current, ...patch }
    setSettingsByCategory((prev) => ({ ...prev, [category]: next }))
    setConfiguredCategories((prev) => new Set(prev).add(category))
    const supabase = createClient()
    const { error } = await supabase
      .from('timetable_settings')
      .upsert({ school_id: currentSchool.id, category, ...next }, { onConflict: 'school_id,category' })
    if (error) alert(`Failed to save settings: ${error.message}`)
  }

  const addBreak = async (category: string) => {
    if (!currentSchool || !category || !newBreakName.trim() || !newBreakAfterPeriod) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('timetable_breaks')
      .insert({
        school_id: currentSchool.id,
        category,
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
    setBreaksByCategory((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), data as BreakRow].sort((a, b) => a.after_period_number - b.after_period_number),
    }))
    setNewBreakName('')
    setNewBreakAfterPeriod('')
    setNewBreakDuration('30')
  }

  const deleteBreak = async (category: string, id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('timetable_breaks').delete().eq('id', id)
    if (error) {
      alert(`Failed to delete break: ${error.message}`)
      return
    }
    setBreaksByCategory((prev) => ({ ...prev, [category]: (prev[category] || []).filter((b) => b.id !== id) }))
  }

  const copySettingsFromCategory = async (targetCategory: string, sourceCategory: string) => {
    if (!currentSchool || !sourceCategory || sourceCategory === targetCategory) return
    const sourceSettings = settingsByCategory[sourceCategory] || getDefaultSettingsForCategory(sourceCategory)
    await saveSettings(targetCategory, sourceSettings)

    const supabase = createClient()
    const existingIds = (breaksByCategory[targetCategory] || []).map((b) => b.id)
    if (existingIds.length > 0) await supabase.from('timetable_breaks').delete().in('id', existingIds)

    const sourceBreaks = breaksByCategory[sourceCategory] || []
    if (sourceBreaks.length > 0) {
      const rows = sourceBreaks.map((b) => ({
        school_id: currentSchool.id,
        category: targetCategory,
        name: b.name,
        after_period_number: b.after_period_number,
        duration_minutes: b.duration_minutes,
      }))
      const { data } = await supabase.from('timetable_breaks').insert(rows).select('*')
      setBreaksByCategory((prev) => ({ ...prev, [targetCategory]: (data || []) as BreakRow[] }))
    } else {
      setBreaksByCategory((prev) => ({ ...prev, [targetCategory]: [] }))
    }
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
  const resolveTeacherForSubject = (classId: string, subjectId: string, category: string): string | null => {
    const specific = assignments.find((a) => a.class_id === classId && a.subject_id === subjectId)
    if (specific) return specific.user_id
    if (!CATEGORIES_WITH_CLASS_TEACHER_FALLBACK.has(category)) return null
    const wholeClass = assignments.find((a) => a.class_id === classId && !a.subject_id)
    return wholeClass ? wholeClass.user_id : null
  }

  const teacherName = (id: string | null) => {
    if (!id) return null
    const t = teachers.find((t) => t.id === id)
    return t ? `${t.first_name} ${t.last_name}` : null
  }

  // The longest break of the day is treated as lunch - schools name breaks
  // freely, so duration is the only reliable signal. Math is hard-excluded
  // from any period after it by the generator.
  const findLunchAfterPeriod = (catBreaks: BreakRow[]): number | null => {
    if (catBreaks.length === 0) return null
    return catBreaks.reduce((longest, b) => (b.duration_minutes > longest.duration_minutes ? b : longest)).after_period_number
  }

  // Flags any teacher assigned more periods/week than an estimated week can
  // physically hold - a real teacher can only be in one place at a time, so
  // this always means some of it can't be placed, however generation runs.
  // Caught here, before generating, instead of showing up as opaque
  // "no more open slots" conflicts afterward.
  interface TeacherLoadWarning {
    teacherId: string
    teacherName: string
    demandedPeriods: number
    approxCapacity: number
    breakdown: { className: string; subjectName: string; periodsPerWeek: number }[]
  }
  const teacherLoadWarnings: TeacherLoadWarning[] = useMemo(() => {
    const byTeacher = new Map<string, { demanded: number; categories: Set<string>; breakdown: TeacherLoadWarning['breakdown'] }>()

    for (const cls of classes) {
      const category = effectiveCategory(cls)
      for (const s of subjects.filter((sub) => sub.class_id === cls.id)) {
        const teacherId = resolveTeacherForSubject(cls.id, s.id, category)
        if (!teacherId) continue
        if (!byTeacher.has(teacherId)) byTeacher.set(teacherId, { demanded: 0, categories: new Set(), breakdown: [] })
        const entry = byTeacher.get(teacherId)!
        entry.demanded += s.periods_per_week
        entry.categories.add(category)
        entry.breakdown.push({ className: cls.name, subjectName: s.name, periodsPerWeek: s.periods_per_week })
      }
    }

    const results: TeacherLoadWarning[] = []
    for (const [teacherId, info] of byTeacher) {
      let approxCapacity = 0
      for (const cat of info.categories) {
        const catSettings = settingsByCategory[cat] || getDefaultSettingsForCategory(cat)
        const catBreaks = breaksByCategory[cat] || []
        const grid = resolveCategoryGrid(cat, catSettings, catBreaks)
        approxCapacity += grid.daysPerWeek * grid.periodsPerDay
      }
      if (info.demanded > approxCapacity) {
        results.push({ teacherId, teacherName: teacherName(teacherId) || 'Unknown', demandedPeriods: info.demanded, approxCapacity, breakdown: info.breakdown })
      }
    }
    return results.sort((a, b) => (b.demandedPeriods - b.approxCapacity) - (a.demandedPeriods - a.approxCapacity))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, subjects, assignments, settingsByCategory, breaksByCategory, teachers])

  const handleGenerate = async () => {
    if (!currentSchool) return
    setIsGenerating(true)
    setGenResult(null)

    const levelWarnings: string[] = []
    const classInputs: TimetableClassInput[] = classes.map((cls) => {
      const category = effectiveCategory(cls)
      if (!configuredCategories.has(category) && !levelWarnings.includes(category)) {
        levelWarnings.push(category)
      }
      const catSettings = settingsByCategory[category] || getDefaultSettingsForCategory(category)
      const catBreaks = breaksByCategory[category] || []
      const grid = resolveCategoryGrid(category, catSettings, catBreaks)

      return {
        classId: cls.id,
        className: cls.name,
        daysPerWeek: grid.daysPerWeek,
        periodsPerDay: grid.periodsPerDay,
        periodStartEndMinutes: grid.periodStartEndMinutes,
        breakAfterPeriods: catBreaks.map((b) => b.after_period_number),
        lunchAfterPeriod: findLunchAfterPeriod(catBreaks),
        enableDoubleLessons: catSettings.enable_double_lessons,
        avoidConsecutiveSameSubject: catSettings.avoid_consecutive_same_subject,
        spreadEvenly: catSettings.spread_evenly,
        subjects: subjects
          .filter((s) => s.class_id === cls.id)
          .map((s) => {
            const teacherId = resolveTeacherForSubject(cls.id, s.id, category)
            return {
              subjectId: s.id,
              subjectName: s.name,
              periodsPerWeek: s.periods_per_week,
              teacherId,
              teacherName: teacherName(teacherId),
            }
          }),
      }
    })

    const teacherMaxPerDay = new Map(teachers.map((t) => [t.id, t.max_periods_per_day]))

    const result = generateTimetable(classInputs, teacherMaxPerDay)

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

    setGenResult({ entryCount: result.entries.length, conflicts: result.conflicts, warnings: result.warnings, levelWarnings })
    setIsGenerating(false)

    // Point the View tab at what was just generated - otherwise it's still
    // sitting on whatever term/class it last had selected (often the default,
    // Term 1) and switching tabs shows "no timetable generated" even though
    // one was just created for a different term. Also pick the first class so
    // switching tabs shows the result immediately, not another empty picker.
    setViewTerm(genTerm)
    setViewYear(genYear)
    setViewMode('class')
    if (classes.length > 0) setViewClassId(classes[0].id)
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

  useEffect(() => {
    setSwapSelection(null)
  }, [viewClassId, viewMode])

  // Full-school entries for the current term/year, independent of which
  // class/teacher the grid is showing - a large school's term can exceed
  // 1000 rows, so this goes through fetchAllRows with a stable .order('id')
  // rather than a plain .select() (see lib/fetch-all-rows.ts).
  const loadAllTermEntries = useCallback(async () => {
    if (!currentSchool) return
    const supabase = createClient()
    const rows = await fetchAllRows<EntryRow>((from, to) =>
      supabase
        .from('timetable_entries')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('term', viewTerm)
        .eq('year', Number(viewYear))
        .order('id')
        .range(from, to)
    )
    setAllTermEntries(rows)
  }, [currentSchool?.id, viewTerm, viewYear])

  useEffect(() => {
    loadAllTermEntries()
  }, [loadAllTermEntries])

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name || 'Unknown'
  const className = (id: string) => classes.find((c) => c.id === id)?.name || 'Unknown'
  const categoryForClassId = (id: string) => {
    const cls = classes.find((c) => c.id === id)
    return cls ? effectiveCategory(cls) : presentCategories[0] || 'General'
  }

  // Most teachers only teach within one CBC level - their view renders
  // exactly like it always has. A teacher whose classes span more than one
  // level needs a merged, real-clock-time axis since period numbers alone
  // don't line up across levels with different day structures.
  const viewCategories = useMemo(() => {
    if (viewMode === 'class') {
      return [viewClassId ? categoryForClassId(viewClassId) : presentCategories[0] || 'General']
    }
    const cats = new Set<string>()
    for (const e of viewEntries) cats.add(categoryForClassId(e.class_id))
    return cats.size > 0 ? [...cats] : [presentCategories[0] || 'General']
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, viewClassId, viewEntries, classes, presentCategories])

  const isMergedView = viewMode === 'teacher' && viewCategories.length > 1

  const viewGrids = useMemo(() => {
    const map = new Map<string, ResolvedCategoryGrid>()
    for (const cat of viewCategories) {
      const catSettings = settingsByCategory[cat] || getDefaultSettingsForCategory(cat)
      const catBreaks = breaksByCategory[cat] || []
      map.set(cat, resolveCategoryGrid(cat, catSettings, catBreaks))
    }
    return map
  }, [viewCategories, settingsByCategory, breaksByCategory])

  const primaryGrid = viewGrids.get(viewCategories[0])
  const mergedColumns = useMemo(() => (isMergedView ? buildMergedColumns([...viewGrids.values()]) : null), [isMergedView, viewGrids])

  // Every present category's grid, not just the ones currently in view -
  // teacher availability/suggestions need to resolve real clock time for ANY
  // of a teacher's bookings across the whole school, not just this view.
  const allCategoryGrids = useMemo(() => {
    const map = new Map<string, ResolvedCategoryGrid>()
    for (const cat of presentCategories) {
      const catSettings = settingsByCategory[cat] || getDefaultSettingsForCategory(cat)
      const catBreaks = breaksByCategory[cat] || []
      map.set(cat, resolveCategoryGrid(cat, catSettings, catBreaks))
    }
    return map
  }, [presentCategories, settingsByCategory, breaksByCategory])

  const entryTimeRange = (entry: EntryRow): { startMinutes: number; endMinutes: number } | null => {
    const grid = allCategoryGrids.get(categoryForClassId(entry.class_id))
    const p = grid?.periodStartEndMinutes.find((x) => x.period === entry.period_number)
    return p ? { startMinutes: p.startMinutes, endMinutes: p.endMinutes } : null
  }

  /** Real-time overlap check against every one of a teacher's other bookings
   * this term, regardless of which class/category they're in - returns what
   * they're doing at that moment if busy, or null if free. */
  const findTeacherConflictAt = (
    teacherId: string,
    day: number,
    targetStartMinutes: number,
    targetEndMinutes: number,
    excludeEntryId?: string
  ): { entryId: string; className: string; subjectName: string } | null => {
    for (const e of allTermEntries) {
      if (e.teacher_id !== teacherId || e.day_of_week !== day) continue
      if (excludeEntryId && e.id === excludeEntryId) continue
      const range = entryTimeRange(e)
      if (range && targetStartMinutes < range.endMinutes && targetEndMinutes > range.startMinutes) {
        return { entryId: e.id, className: className(e.class_id), subjectName: subjectName(e.subject_id) }
      }
    }
    return null
  }

  // --- Block Timetable (whole-school master timetable) ---
  // A separate block timetable per CBC level (Pre-School/Lower Primary/Upper
  // Primary/Junior Secondary/General), not one grid merging every level -
  // each level runs its own day structure, so "period 3" already means a
  // different real time in different levels; keeping each level's own plain
  // period-number columns (like a normal, single-category timetable) is both
  // simpler and far less sparse than forcing everything onto one merged
  // real-time axis.
  const teacherInitials = useMemo(() => computeTeacherInitials(teachers), [teachers])

  const blockDaysAvailable = Math.max(1, ...presentCategories.map((c) => allCategoryGrids.get(c)?.daysPerWeek || 0))

  const blockDayList = useMemo(
    () => (blockDay === 'all' ? Array.from({ length: blockDaysAvailable }, (_, i) => i + 1) : [blockDay]),
    [blockDay, blockDaysAvailable]
  )

  interface BlockCategorySection {
    category: string
    columns: { key: string; label: string; subLabel: string }[]
    days: { day: number; dayLabel: string; rows: BlockTimetableRow[] }[]
  }

  // One section per level, each with its own columns (that level's own real
  // periods) and one sub-section per selected day - just the one day
  // normally, every day when "All Days" is picked. Doesn't need to fit on
  // one screen/page; it just stacks and, when printed, each level+day
  // combination starts its own page.
  const blockCategorySections: BlockCategorySection[] = useMemo(() => {
    return presentCategories
      .map((category) => {
        const grid = allCategoryGrids.get(category)
        if (!grid) return null
        const columns = grid.periodTimes.map((p) => ({ key: String(p.period), label: `Period ${p.period}`, subLabel: `${p.startTime} - ${p.endTime}` }))
        const categoryClasses = classes.filter((cls) => effectiveCategory(cls) === category)
        const days = blockDayList
          .filter((day) => day <= grid.daysPerWeek)
          .map((day) => ({
            day,
            dayLabel: DAY_LABELS[day - 1] || `Day ${day}`,
            rows: categoryClasses.map((cls) => {
              const cells: BlockTimetableRow['cells'] = {}
              for (const e of allTermEntries) {
                if (e.class_id !== cls.id || e.day_of_week !== day) continue
                cells[String(e.period_number)] = {
                  subjectName: subjectName(e.subject_id),
                  teacherInitials: e.teacher_id ? (teacherInitials.get(e.teacher_id) || '?') : '',
                }
              }
              return { className: cls.name, cells }
            }),
          }))
        return { category, columns, days }
      })
      .filter((s): s is BlockCategorySection => !!s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentCategories, allCategoryGrids, classes, allTermEntries, blockDayList, teacherInitials])

  const blockLegend = useMemo(() => {
    const usedTeacherIds = new Set<string>()
    for (const e of allTermEntries) {
      if (blockDayList.includes(e.day_of_week) && e.teacher_id) usedTeacherIds.add(e.teacher_id)
    }
    return teachers
      .filter((t) => usedTeacherIds.has(t.id))
      .map((t) => ({ initials: teacherInitials.get(t.id) || '?', name: `${t.first_name} ${t.last_name}` }))
      .sort((a, b) => a.initials.localeCompare(b.initials))
  }, [teachers, teacherInitials, allTermEntries, blockDayList])

  const handleBlockPrint = () => {
    if (!currentSchool) return
    const sections = blockCategorySections.flatMap((section) =>
      section.days.map((d) => ({
        sectionLabel: `${section.category} - ${d.dayLabel}`,
        columns: section.columns,
        rows: d.rows,
      }))
    )
    const html = generateBlockTimetablePrintHTML({
      title: 'Block Timetable',
      schoolName: currentSchool.name,
      termLabel: `${viewTerm} ${viewYear}`,
      sections,
      legend: blockLegend,
    })
    openTimetablePrintWindow(html)
  }

  const gridCells: Record<string, TimetableGridCell> = useMemo(() => {
    const cells: Record<string, TimetableGridCell> = {}
    for (const e of viewEntries) {
      let columnKey: string
      if (isMergedView) {
        const grid = viewGrids.get(categoryForClassId(e.class_id))
        const key = grid ? mergedColumnKeyFor(grid, e.period_number) : null
        if (!key) continue
        columnKey = key
      } else {
        columnKey = String(e.period_number)
      }
      cells[`${e.day_of_week}|${columnKey}`] = {
        subjectId: e.subject_id,
        subjectName: subjectName(e.subject_id),
        teacherId: e.teacher_id,
        subtitle: viewMode === 'class' ? teacherName(e.teacher_id) : className(e.class_id),
      }
    }
    return cells
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewEntries, viewMode, isMergedView, viewGrids, subjects, classes, teachers])

  const gridDaysPerWeek = isMergedView
    ? Math.max(5, ...[...viewGrids.values()].map((g) => g.daysPerWeek))
    : (primaryGrid?.daysPerWeek || 5)

  const primaryGridBreaks = (breaksByCategory[viewCategories[0]] || []).map((b) => ({
    name: b.name,
    afterPeriodNumber: b.after_period_number,
    durationMinutes: b.duration_minutes,
  }))

  const handlePrint = () => {
    if (!currentSchool) return
    const title = viewMode === 'class' ? `${className(viewClassId)} - Timetable` : `${teacherName(viewTeacherId) || 'Teacher'} - Timetable`
    const html = isMergedView && mergedColumns
      ? generateTimetablePrintHTML({
          title,
          schoolName: currentSchool.name,
          termLabel: `${viewTerm} ${viewYear}`,
          daysPerWeek: gridDaysPerWeek,
          columns: mergedColumns.map((c) => ({ key: c.key, label: c.label, subLabel: `- ${c.subLabel}` })),
          cells: gridCells,
        })
      : generateTimetablePrintHTML({
          title,
          schoolName: currentSchool.name,
          termLabel: `${viewTerm} ${viewYear}`,
          daysPerWeek: gridDaysPerWeek,
          periodsPerDay: primaryGrid?.periodsPerDay || 0,
          breaks: primaryGridBreaks,
          periodTimes: primaryGrid?.periodTimes || [],
          cells: gridCells,
        })
    openTimetablePrintWindow(html)
  }

  // --- Manual edit (class view only - a teacher's schedule is a read-only rollup of their classes) ---
  const editingGrid = viewClassId ? allCategoryGrids.get(categoryForClassId(viewClassId)) : undefined

  const openCellEditor = (day: number, period: number) => {
    const entry = viewEntries.find((e) => e.day_of_week === day && e.period_number === period) || null
    setEditingCell({ day, period, entry })
    setEditSubjectId(entry?.subject_id || '')
    setEditTeacherId(entry?.teacher_id || '')
    setShowCustomSubjectInput(false)
    setCustomSubjectName('')
  }

  const handleCellClick = (day: number, period: number) => {
    if (viewMode !== 'class' || !viewClassId) return
    if (swapMode) {
      const entry = viewEntries.find((e) => e.day_of_week === day && e.period_number === period) || null
      if (!swapSelection) {
        setSwapSelection({ day, period, entry })
        return
      }
      if (swapSelection.day === day && swapSelection.period === period) {
        setSwapSelection(null)
        return
      }
      performSwap(swapSelection, { day, period, entry })
      return
    }
    openCellEditor(day, period)
  }

  const performSwap = async (
    a: { day: number; period: number; entry: EntryRow | null },
    b: { day: number; period: number; entry: EntryRow | null }
  ) => {
    if (!currentSchool || !viewClassId) return
    const label = (side: { day: number; period: number; entry: EntryRow | null }) =>
      side.entry ? `${subjectName(side.entry.subject_id)} (Day ${side.day} P${side.period})` : `Empty (Day ${side.day} P${side.period})`
    const proceed = confirm(`Swap ${label(a)} with ${label(b)}?`)
    if (!proceed) {
      setSwapSelection(null)
      return
    }

    const supabase = createClient()
    if (a.entry) await supabase.from('timetable_entries').delete().eq('id', a.entry.id)
    if (b.entry) await supabase.from('timetable_entries').delete().eq('id', b.entry.id)

    const inserts = []
    if (b.entry) {
      inserts.push({
        school_id: currentSchool.id, class_id: viewClassId, subject_id: b.entry.subject_id, teacher_id: b.entry.teacher_id,
        day_of_week: a.day, period_number: a.period, term: viewTerm, year: Number(viewYear),
      })
    }
    if (a.entry) {
      inserts.push({
        school_id: currentSchool.id, class_id: viewClassId, subject_id: a.entry.subject_id, teacher_id: a.entry.teacher_id,
        day_of_week: b.day, period_number: b.period, term: viewTerm, year: Number(viewYear),
      })
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from('timetable_entries').insert(inserts)
      if (error) alert(`Failed to swap: ${error.message}`)
    }

    setSwapSelection(null)
    loadViewEntries()
    loadAllTermEntries()
  }

  // Shown once a teacher is picked in the dialog - real busy/free status
  // against every one of their other bookings this term, not just a
  // same-period-number check, so it stays correct across CBC levels.
  const editTeacherAvailability = useMemo(() => {
    if (!editingCell || !editTeacherId || !editingGrid) return null
    const targetTime = editingGrid.periodStartEndMinutes.find((p) => p.period === editingCell.period)
    if (!targetTime) return null
    const conflict = findTeacherConflictAt(editTeacherId, editingCell.day, targetTime.startMinutes, targetTime.endMinutes, editingCell.entry?.id)
    const freePeriods: number[] = []
    for (const p of editingGrid.periodStartEndMinutes) {
      if (p.period === editingCell.period) continue
      if (!findTeacherConflictAt(editTeacherId, editingCell.day, p.startMinutes, p.endMinutes, editingCell.entry?.id)) freePeriods.push(p.period)
    }
    return { conflict, freePeriods }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell, editTeacherId, editingGrid, allTermEntries])

  // Only for an empty cell: which subjects still need periods this week, and
  // whether their resolved teacher is actually free at this exact slot -
  // ranked so the most-needed, actually-placeable option shows first.
  const cellSuggestions = useMemo(() => {
    if (!editingCell || editingCell.entry || !viewClassId || !editingGrid) return []
    const targetTime = editingGrid.periodStartEndMinutes.find((p) => p.period === editingCell.period)
    if (!targetTime) return []
    const category = categoryForClassId(viewClassId)
    const results: { subjectId: string; subjectName: string; teacherId: string | null; teacherName: string | null; remaining: number; teacherFree: boolean }[] = []
    for (const s of subjects.filter((sub) => sub.class_id === viewClassId)) {
      const placed = viewEntries.filter((e) => e.subject_id === s.id).length
      const remaining = s.periods_per_week - placed
      if (remaining <= 0) continue
      const teacherId = resolveTeacherForSubject(viewClassId, s.id, category)
      const teacherFree = teacherId ? !findTeacherConflictAt(teacherId, editingCell.day, targetTime.startMinutes, targetTime.endMinutes) : true
      results.push({ subjectId: s.id, subjectName: s.name, teacherId, teacherName: teacherName(teacherId), remaining, teacherFree })
    }
    results.sort((x, y) => (Number(y.teacherFree) - Number(x.teacherFree)) || (y.remaining - x.remaining))
    return results.slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell, viewClassId, editingGrid, subjects, viewEntries, assignments, allTermEntries])

  const addCustomSubject = async () => {
    if (!customSubjectName.trim() || !viewClassId) return
    setIsAddingCustomSubject(true)
    const name = customSubjectName.trim().toUpperCase()
    const existing = subjects.find((s) => s.class_id === viewClassId && s.name.toUpperCase() === name)
    if (existing) {
      setEditSubjectId(existing.id)
      setEditTeacherId('')
      setShowCustomSubjectInput(false)
      setCustomSubjectName('')
      setIsAddingCustomSubject(false)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase
      .from('subjects')
      .insert({ class_id: viewClassId, name, is_custom: true, periods_per_week: 0 })
      .select('id, class_id, name, periods_per_week')
      .single()
    setIsAddingCustomSubject(false)
    if (error) {
      alert(`Failed to add subject: ${error.message}`)
      return
    }
    setSubjects((prev) => [...prev, data as SubjectRow])
    setEditSubjectId(data.id)
    setEditTeacherId('')
    setShowCustomSubjectInput(false)
    setCustomSubjectName('')
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
      if (teacherId && editingGrid) {
        const targetTime = editingGrid.periodStartEndMinutes.find((p) => p.period === editingCell.period)
        const clash = targetTime
          ? findTeacherConflictAt(teacherId, editingCell.day, targetTime.startMinutes, targetTime.endMinutes, editingCell.entry?.id)
          : null
        if (clash) {
          const proceed = confirm(
            `${teacherName(teacherId)} is already teaching ${clash.className} (${clash.subjectName}) at this time. Moving them here will unassign them from that slot. Continue?`
          )
          if (!proceed) {
            setIsSavingEdit(false)
            return
          }
          await supabase.from('timetable_entries').delete().eq('id', clash.entryId)
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
    loadAllTermEntries()
  }

  const editingClassSubjects = subjects.filter((s) => s.class_id === viewClassId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  // Defense in depth - the nav link is already hidden when this isn't
  // enabled, but the route itself is still reachable directly by URL.
  if (!currentSchool?.feature_timetabling) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          Timetabling isn't enabled for this school yet. Contact ShuleTech to have it switched on.
        </CardContent>
      </Card>
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
          <TabsTrigger value="block">Block Timetable</TabsTrigger>
        </TabsList>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          {presentCategories.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-gray-500">No classes found for this school yet.</CardContent></Card>
          ) : (
            <Tabs value={settingsCategoryTab} onValueChange={setSettingsCategoryTab} className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                {presentCategories.map((cat) => (
                  <TabsTrigger key={cat} value={cat}>
                    {cat}{!configuredCategories.has(cat) && <span className="ml-1 text-amber-500" title="Using default settings - not yet saved">*</span>}
                  </TabsTrigger>
                ))}
              </TabsList>

              {presentCategories.map((cat) => {
                const catSettings = settingsByCategory[cat] || getDefaultSettingsForCategory(cat)
                const catBreaks = breaksByCategory[cat] || []
                const grid = resolveCategoryGrid(cat, catSettings, catBreaks)
                const otherCategories = presentCategories.filter((c) => c !== cat)

                return (
                  <TabsContent key={cat} value={cat} className="space-y-4">
                    {!configuredCategories.has(cat) && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        {cat} hasn&apos;t been configured yet - showing sensible defaults for this level. Adjust and they&apos;ll be saved automatically.
                      </p>
                    )}

                    {otherCategories.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Copy settings from</span>
                        <Select value={copyFromCategory} onValueChange={setCopyFromCategory}>
                          <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Choose a level" /></SelectTrigger>
                          <SelectContent>{otherCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!copyFromCategory}
                          onClick={() => copySettingsFromCategory(cat, copyFromCategory)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SettingsIcon className="w-4 h-4" /> {cat} - Hours &amp; Days</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Start Time</Label>
                          <Input type="time" value={catSettings.school_start_time} onChange={(e) => saveSettings(cat, { school_start_time: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label>End Time</Label>
                          <Input type="time" value={catSettings.school_end_time} onChange={(e) => saveSettings(cat, { school_end_time: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label>Period Length</Label>
                          <Select value={catSettings.period_length_minutes.toString()} onValueChange={(v) => saveSettings(cat, { period_length_minutes: Number(v) })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PERIOD_LENGTH_OPTIONS.map((m) => <SelectItem key={m} value={m.toString()}>{m} minutes</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Days</Label>
                          <Select value={catSettings.days_per_week.toString()} onValueChange={(v) => saveSettings(cat, { days_per_week: Number(v) })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">Monday - Friday (5 days)</SelectItem>
                              <SelectItem value="6">Monday - Saturday (6 days)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2 text-xs text-gray-500">
                          {grid.periodsPerDay} teaching periods fit per day for {cat} with the current settings and breaks.
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>{cat} - Breaks</CardTitle>
                        <CardDescription>Add every break in this level&apos;s day (morning break, lunch, etc.)</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {catBreaks.map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                            <span>{b.name} - after period {b.after_period_number}, {b.duration_minutes} min</span>
                            <Button size="sm" variant="ghost" onClick={() => deleteBreak(cat, b.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
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
                          <Button size="sm" onClick={() => addBreak(cat)}><Plus className="w-4 h-4 mr-1" /> Add Break</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>{cat} - Generation Options</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={catSettings.avoid_consecutive_same_subject} onChange={(e) => saveSettings(cat, { avoid_consecutive_same_subject: e.target.checked })} />
                          Avoid consecutive same-subject periods (recommended)
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={catSettings.spread_evenly} onChange={(e) => saveSettings(cat, { spread_evenly: e.target.checked })} />
                          Spread periods evenly across the week (recommended)
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={catSettings.enable_double_lessons} onChange={(e) => saveSettings(cat, { enable_double_lessons: e.target.checked })} />
                          Enable double lessons (2 consecutive periods) - a JSS/STEM convention, off by default outside Junior Secondary
                        </label>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )
              })}
            </Tabs>
          )}

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
          {teacherLoadWarnings.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
                  <AlertTriangle className="w-4 h-4" /> {teacherLoadWarnings.length} teacher{teacherLoadWarnings.length !== 1 ? 's' : ''} may be over-assigned
                </CardTitle>
                <CardDescription className="text-amber-700">
                  Each of these is assigned more periods/week than an estimated week can hold (days &times; periods/day for the level(s) they teach in). Generation will still run, but expect conflicts for them until their assignments are adjusted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {teacherLoadWarnings.map((w) => (
                  <div key={w.teacherId} className="text-xs bg-white border border-amber-200 rounded p-2">
                    <p className="font-medium text-amber-800">{w.teacherName}: {w.demandedPeriods} periods/week assigned, ~{w.approxCapacity} available</p>
                    <ul className="mt-1 space-y-0.5 text-gray-600">
                      {w.breakdown.map((b, i) => <li key={i}>{b.className} - {b.subjectName}: {b.periodsPerWeek}/wk</li>)}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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

                  {genResult.levelWarnings.length > 0 && (
                    <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-700">
                      {genResult.levelWarnings.join(', ')} {genResult.levelWarnings.length === 1 ? 'was' : 'were'} generated using default hours/days since {genResult.levelWarnings.length === 1 ? 'it hasn\'t' : 'they haven\'t'} been configured yet - visit the Settings tab to fine-tune {genResult.levelWarnings.length === 1 ? 'it' : 'them'} and regenerate.
                    </div>
                  )}

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
                      <p className="text-sm font-medium text-amber-700 flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-4 h-4" /> {genResult.warnings.length} subject{genResult.warnings.length !== 1 ? 's' : ''} with no teacher assigned
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        These periods were still placed on the timetable, just with no teacher shown for them. Assign a teacher to each in the admin portal&apos;s Teachers section, then regenerate to fill them in.
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {genResult.warnings.map((w, i) => (
                          <div key={i} className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            <span className="font-medium">{w.className}</span> - {w.subjectName}
                          </div>
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

                {viewMode === 'class' && viewClassId && (
                  <Button
                    size="sm"
                    variant={swapMode ? 'default' : 'outline'}
                    onClick={() => { setSwapMode((m) => !m); setSwapSelection(null) }}
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-1" /> {swapMode ? 'Exit Swap Mode' : 'Swap Mode'}
                  </Button>
                )}
              </div>

              {isMergedView && (
                <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
                  This teacher has classes in more than one level ({viewCategories.join(', ')}), which run on different daily schedules - showing a merged view by real time instead of period number.
                </p>
              )}

              {swapMode && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                  {swapSelection ? 'Now click the cell to swap it with.' : 'Click a cell, then click a second cell to exchange them.'}
                </p>
              )}

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
              ) : isMergedView && mergedColumns ? (
                <TimetableGrid
                  daysPerWeek={gridDaysPerWeek}
                  columns={mergedColumns.map((c) => ({ key: c.key, label: c.label, subLabel: `- ${c.subLabel}` }))}
                  cells={gridCells}
                />
              ) : (
                <TimetableGrid
                  daysPerWeek={gridDaysPerWeek}
                  periodsPerDay={primaryGrid?.periodsPerDay || 0}
                  breaks={primaryGridBreaks}
                  periodTimes={primaryGrid?.periodTimes || []}
                  cells={gridCells}
                  onCellClick={viewMode === 'class' ? handleCellClick : undefined}
                  highlightedKey={swapSelection ? `${swapSelection.day}|${swapSelection.period}` : undefined}
                />
              )}
              {viewMode === 'class' && viewClassId && !swapMode && <p className="text-xs text-gray-400">Click any cell to manually adjust it.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BLOCK TIMETABLE */}
        <TabsContent value="block" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Block Timetable</CardTitle>
              <CardDescription>The whole school - every class, with teacher initials in each cell. View one day or the whole week at once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <Select value={String(blockDay)} onValueChange={(v) => setBlockDay(v === 'all' ? 'all' : Number(v))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Days</SelectItem>
                    {DAY_LABELS.slice(0, blockDaysAvailable).map((label, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={viewTerm} onValueChange={setViewTerm}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={viewYear} onValueChange={setViewYear}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={handleBlockPrint} disabled={blockCategorySections.length === 0}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
              </div>

              {classes.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No classes found for this school yet.</p>
              ) : blockCategorySections.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No timetable generated yet for {viewTerm} {viewYear}. Generate one from the Generate tab.</p>
              ) : (
                <>
                  <Tabs defaultValue={blockCategorySections[0].category} className="space-y-4">
                    <TabsList className="flex flex-wrap h-auto gap-1">
                      {blockCategorySections.map((section) => (
                        <TabsTrigger key={section.category} value={section.category}>{section.category}</TabsTrigger>
                      ))}
                    </TabsList>
                    {blockCategorySections.map((section) => (
                      <TabsContent key={section.category} value={section.category} className="space-y-4">
                        {section.days.length === 0 ? (
                          <p className="text-sm text-gray-500 py-4 text-center">Nothing generated for {section.category} yet for this term.</p>
                        ) : (
                          section.days.map((d) => (
                            <div key={d.day} className="space-y-2">
                              {blockDay === 'all' && <h3 className="font-semibold text-gray-800 text-sm pt-2">{d.dayLabel}</h3>}
                              <div className="overflow-x-auto">
                                <table className="border-collapse text-xs w-full">
                                  <thead>
                                    <tr>
                                      <th className="border border-gray-300 px-2 py-1.5 bg-gray-100 text-left sticky left-0">Class</th>
                                      {section.columns.map((col) => (
                                        <th key={col.key} className="border border-gray-300 px-1.5 py-1.5 bg-gray-100 min-w-[70px]">
                                          <div>{col.label}</div>
                                          <div className="font-normal text-gray-500">{col.subLabel}</div>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.rows.map((row) => (
                                      <tr key={row.className}>
                                        <td className="border border-gray-300 px-2 py-1 font-medium bg-gray-50 sticky left-0 whitespace-nowrap">{row.className}</td>
                                        {section.columns.map((col) => {
                                          const cell = row.cells[col.key]
                                          return (
                                            <td key={col.key} className="border border-gray-300 px-1.5 py-1 align-top">
                                              {cell ? (
                                                <div>
                                                  <div className="font-medium text-gray-900 truncate">{cell.subjectName}</div>
                                                  <div className="text-blue-700 font-semibold">{cell.teacherInitials}</div>
                                                </div>
                                              ) : (
                                                <span className="text-gray-300">-</span>
                                              )}
                                            </td>
                                          )
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>

                  {blockLegend.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Teacher Initials</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                        {blockLegend.map((l) => (
                          <span key={l.initials}><span className="font-semibold text-blue-700">{l.initials}</span> = {l.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingCell} onOpenChange={(open) => { if (!open) { setEditingCell(null); setShowCustomSubjectInput(false); setCustomSubjectName('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Period</DialogTitle>
            <DialogDescription>
              {editingCell && `${className(viewClassId)} - Day ${editingCell.day}, Period ${editingCell.period}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {cellSuggestions.length > 0 && (
              <div>
                <Label className="text-xs text-gray-500 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Suggestions</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {cellSuggestions.map((s) => (
                    <button
                      key={s.subjectId}
                      type="button"
                      onClick={() => { setEditSubjectId(s.subjectId); setEditTeacherId(s.teacherId || ''); setShowCustomSubjectInput(false) }}
                      className={`text-xs px-2 py-1 rounded-full border ${s.teacherFree ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                    >
                      {s.subjectName}{s.teacherName ? ` - ${s.teacherName}` : ''} ({s.remaining} left){s.teacherId && !s.teacherFree ? ' - busy' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Subject</Label>
              <Select
                value={showCustomSubjectInput ? '__custom__' : editSubjectId || 'none'}
                onValueChange={(v) => {
                  if (v === '__custom__') { setShowCustomSubjectInput(true); return }
                  setEditSubjectId(v === 'none' ? '' : v)
                  setEditTeacherId('')
                  setShowCustomSubjectInput(false)
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="No subject (leave empty)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject (leave empty)</SelectItem>
                  {editingClassSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  <SelectItem value="__custom__">+ Custom subject...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCustomSubjectInput && (
              <div className="space-y-2 p-2 border rounded bg-gray-50">
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => setCustomSubjectName('PE')}>PE</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setCustomSubjectName('Life Skills')}>Life Skills</Button>
                </div>
                <div className="flex gap-2">
                  <Input value={customSubjectName} onChange={(e) => setCustomSubjectName(e.target.value)} placeholder="Subject name" className="h-8" />
                  <Button type="button" size="sm" onClick={addCustomSubject} disabled={!customSubjectName.trim() || isAddingCustomSubject}>
                    {isAddingCustomSubject ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </div>
            )}

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
                {editTeacherId && editTeacherAvailability && (
                  <p className={`text-xs rounded px-2 py-1.5 mt-1.5 ${editTeacherAvailability.conflict ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {editTeacherAvailability.conflict
                      ? `Busy at this time - teaching ${editTeacherAvailability.conflict.className} (${editTeacherAvailability.conflict.subjectName}).`
                      : 'Free at this time.'}
                    {editTeacherAvailability.freePeriods.length > 0 && ` Free periods today: ${editTeacherAvailability.freePeriods.join(', ')}.`}
                  </p>
                )}
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
