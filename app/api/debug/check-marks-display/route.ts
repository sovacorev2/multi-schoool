import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the latest marks that were entered (ordered by updated_at desc)
    const { data: recentMarks } = await supabase
      .from('marks')
      .select('id, learner_id, subject_id, session_id, score, year, term, exam_type_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)

    // Get info for each recent mark - learner, subject, session, class
    const markDetails = await Promise.all((recentMarks || []).map(async (mark) => {
      const { data: learner } = await supabase
        .from('learners')
        .select('name, class_id')
        .eq('id', mark.learner_id)
        .single()

      const { data: subject } = await supabase
        .from('subjects')
        .select('name, class_id')
        .eq('id', mark.subject_id)
        .single()

      const { data: session } = await supabase
        .from('sessions')
        .select('id, class_id, term, year, is_active')
        .eq('id', mark.session_id)
        .single()

      const { data: klass } = await supabase
        .from('classes')
        .select('id, name, school_id')
        .eq('id', session?.class_id || null)
        .single()

      return {
        markId: mark.id,
        score: mark.score,
        updatedAt: mark.updated_at,
        learner: learner?.name || 'UNKNOWN',
        learnerClassId: learner?.class_id,
        subject: subject?.name || 'UNKNOWN',
        subjectClassId: subject?.class_id,
        sessionTerm: session?.term,
        sessionYear: session?.year,
        sessionClassId: session?.class_id,
        className: klass?.name || 'UNKNOWN',
        schoolId: klass?.school_id,
        classMatch: learner?.class_id === subject?.class_id && subject?.class_id === session?.class_id
      }
    }))

    return NextResponse.json({
      totalRecentMarks: recentMarks?.length || 0,
      markDetails: markDetails,
      issuesDetected: markDetails.filter(m => !m.classMatch)
    })
  } catch (error: any) {
    console.error('[v0] Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
