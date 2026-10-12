'use server'

import { createClient } from '@/lib/supabase/server'

// Since scripts/024 enabled RLS on classes and teacher_accounts with no SELECT
// policy, browser-side .update()/.delete() on those tables silently match zero
// rows: Postgres applies SELECT policies to the WHERE clause of an UPDATE or
// DELETE, so the row is invisible and nothing is written - with no error.
// Renaming classes, deleting streams, setting class passwords/teachers and
// editing teachers all quietly stopped saving. These actions do the same
// writes server-side (service-role, bypasses RLS) and fail loudly if no row
// was actually affected.

type Result = { success: boolean; error?: string }

export interface ClassUpdate {
  name?: string
  display_order?: number
  teacher_name?: string | null
  password?: string | null
}

export interface TeacherUpdate {
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string | null
  max_periods_per_day?: number | null
  email_sent?: boolean
}

const CLASS_FIELDS: (keyof ClassUpdate)[] = ['name', 'display_order', 'teacher_name', 'password']
const TEACHER_FIELDS: (keyof TeacherUpdate)[] = ['first_name', 'last_name', 'email', 'phone_number', 'max_periods_per_day', 'email_sent']

function pick<T extends object>(input: T, allowed: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const key of allowed) {
    if (input[key] !== undefined) out[key] = input[key]
  }
  return out
}

export async function updateClass(classId: string, fields: ClassUpdate): Promise<Result> {
  const supabase = await createClient()
  const update = pick(fields, CLASS_FIELDS)

  if (update.name !== undefined) {
    const name = update.name.trim().replace(/\s+/g, ' ')
    if (!name) return { success: false, error: 'Class name cannot be empty' }
    update.name = name

    const { data: current } = await supabase.from('classes').select('school_id').eq('id', classId).single()
    if (!current) return { success: false, error: 'Class not found' }

    const { data: clash } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', current.school_id)
      .ilike('name', name)
      .neq('id', classId)
      .limit(1)
    if (clash && clash.length > 0) return { success: false, error: `A class named "${name}" already exists` }
  }

  const { data, error } = await supabase.from('classes').update(update).eq('id', classId).select('id')
  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Class not found' }
  return { success: true }
}

export async function deleteClass(classId: string): Promise<Result> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('classes').delete().eq('id', classId).select('id')
  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Class not found' }
  return { success: true }
}

export async function updateTeacherAccount(teacherId: string, fields: TeacherUpdate, schoolId?: string): Promise<Result> {
  const supabase = await createClient()
  let query = supabase.from('teacher_accounts').update(pick(fields, TEACHER_FIELDS)).eq('id', teacherId)
  if (schoolId) query = query.eq('school_id', schoolId)
  const { data, error } = await query.select('id')
  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Teacher not found' }
  return { success: true }
}

export async function deleteTeacherAccount(teacherId: string, schoolId?: string): Promise<Result> {
  const supabase = await createClient()
  let query = supabase.from('teacher_accounts').delete().eq('id', teacherId)
  if (schoolId) query = query.eq('school_id', schoolId)
  const { data, error } = await query.select('id')
  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Teacher not found' }
  return { success: true }
}
