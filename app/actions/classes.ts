'use server'

import { createClient } from '@/lib/supabase/server'
import { TERMS } from '@/app/admin-portal/_shared/utils'

export interface CreatedClass {
  id: string
  name: string
  code: string | null
  display_order: number
  teacher_name: string | null
  school_id: string
  created_at: string
}

/** Creates a class (with a default 'welcome' password, matching this app's
 * existing convention) and its per-term sessions, returning only the safe,
 * non-credential fields - classes has no anon SELECT access at all once
 * locked down, so the browser can no longer chain .insert().select() to get
 * the new row back the way app/admin-portal/classes-exams/page.tsx used to;
 * this action does the insert server-side (service-role, unaffected by that
 * restriction) and hands back exactly what the client needs to update its
 * own state. */
export async function createClass(schoolId: string, name: string, displayOrder: number): Promise<{ success: boolean; error?: string; class?: CreatedClass }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('classes')
    .insert({ name, school_id: schoolId, password: 'welcome', display_order: displayOrder })
    .select('id, name, code, display_order, teacher_name, school_id, created_at')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create class' }
  }

  const currentYear = new Date().getFullYear()
  const sessionsToInsert = TERMS.map((term) => ({
    class_id: data.id, year: currentYear, term, is_active: true, school_id: schoolId,
  }))
  await supabase.from('sessions').insert(sessionsToInsert)

  return { success: true, class: data as CreatedClass }
}
