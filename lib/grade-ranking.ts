// Grade-wide ("overall", across every stream) ranking for one exam session -
// shared by the report card's Overall Position and the parent WhatsApp/SMS
// results messages so the two can never disagree.
//
// Basis: total raw marks across every stream of the learner's grade, out of
// every learner enrolled in the grade. Equal totals share a rank (1, 2, 2, 4),
// matching how the within-class position already treats ties.
//
// Marks and learners are paged with fetchAllRows: a grade can easily exceed
// PostgREST's silent 1000-row cap (128 learners x 9 subjects = 1,152 marks),
// and a plain select() would quietly drop the overflow and mis-rank whoever's
// marks fell past it.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRows } from '@/lib/fetch-all-rows'

export interface GradeRanking {
  byLearner: Record<string, number>
  totalInGrade: number
  gradeName: string
  classCount: number
}

export function getGradeName(className: string): string {
  const trimmed = (className || '').trim()
  const words = trimmed.split(/\s+/)
  // "Grade 9 BLUE" -> "Grade 9"; "Grade 9" / "PP1" stay as they are ("PP1 A" -> "PP1").
  if (words.length > 2) return words.slice(0, -1).join(' ')
  return trimmed.match(/^(PP\s*\d+|Grade\s+\d+)/i)?.[0] || trimmed
}

export async function fetchGradeRanking(
  supabase: SupabaseClient,
  schoolId: string,
  className: string,
  session: { exam_type_id: string | null; term: string; year: number }
): Promise<GradeRanking | null> {
  const gradeName = getGradeName(className)

  const { data: candidates, error: classErr } = await supabase
    .from('classes_public')
    .select('id, name')
    .eq('school_id', schoolId)
    .ilike('name', `${gradeName}%`)
  if (classErr) return null

  // "Grade 1%" must not swallow "Grade 10" - match the whole grade word.
  const escaped = gradeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const gradeRegex = new RegExp(`^${escaped}(\\s|$)`, 'i')
  const gradeClassIds = (candidates || []).filter((c: { name: string }) => gradeRegex.test(c.name)).map((c: { id: string }) => c.id)
  if (gradeClassIds.length === 0) return null

  const [gradeLearners, gradeMarks] = await Promise.all([
    fetchAllRows<{ id: string }>((from, to) =>
      supabase.from('learners').select('id').in('class_id', gradeClassIds).order('id').range(from, to)
    ),
    fetchAllRows<{ learner_id: string; score: number | null }>((from, to) =>
      supabase
        .from('marks')
        .select('learner_id, score, sessions!inner(class_id, exam_type_id, term, year)')
        .in('sessions.class_id', gradeClassIds)
        .eq('sessions.exam_type_id', session.exam_type_id)
        .eq('sessions.term', session.term)
        .eq('sessions.year', session.year)
        .order('id')
        .range(from, to)
    ),
  ])

  const totals: Record<string, number> = {}
  for (const m of gradeMarks) {
    if (m?.learner_id && m.score !== null && m.score !== undefined) {
      totals[m.learner_id] = (totals[m.learner_id] || 0) + (Number(m.score) || 0)
    }
  }

  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const byLearner: Record<string, number> = {}
  sorted.forEach(([id, total], index) => {
    byLearner[id] = index > 0 && total === sorted[index - 1][1] ? byLearner[sorted[index - 1][0]] : index + 1
  })

  return { byLearner, totalInGrade: gradeLearners.length, gradeName, classCount: gradeClassIds.length }
}
