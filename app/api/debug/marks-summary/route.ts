import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('[v0] Starting comprehensive marks debug report...')

    // Get Amagoro
    const { data: amagoroSchool } = await supabase
      .from('schools')
      .select('id, name')
      .ilike('name', '%amagoro%')
      .single()

    if (!amagoroSchool) throw new Error('Amagoro not found')

    // Get Grade 9 classes
    const { data: grade9 } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', amagoroSchool.id)
      .ilike('name', '%grade 9%')

    const g9ClassIds = grade9?.map(c => c.id) || []

    // Get sessions for Grade 9
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_id, term, year, is_active')
      .in('class_id', g9ClassIds)

    const sessionIds = sessions?.map(s => s.id) || []

    // Count marks total
    const { data: marksTotal } = await supabase
      .from('marks')
      .select('id')
      .in('session_id', sessionIds)

    // Get marks with actual scores (not null)
    const { data: marksWithScores } = await supabase
      .from('marks')
      .select('id, session_id, learner_id, subject_id, score')
      .in('session_id', sessionIds)
      .not('score', 'is', null)
      .limit(20)

    // Get latest 30 marks ordered by created_at
    const { data: latestMarks } = await supabase
      .from('marks')
      .select('id, session_id, score, updated_at')
      .in('session_id', sessionIds)
      .order('updated_at', { ascending: false })
      .limit(30)

    // Get teacher assignments for Grade 9
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('*, users(first_name, last_name)')
      .in('class_id', g9ClassIds)
      .eq('is_active', true)

    // Build comprehensive report
    const report = {
      school: amagoroSchool.name,
      grade9Classes: grade9,
      sessionCount: sessions?.length || 0,
      stats: {
        totalMarksRecords: marksTotal?.length || 0,
        marksWithActualScores: marksWithScores?.length || 0,
        teacherAssignmentsActive: assignments?.length || 0
      },
      recentMarksTimeline: latestMarks?.map(m => ({
        score: m.score,
        updatedAt: m.updated_at
      })),
      teacherAssignments: assignments?.map(a => ({
        className: grade9?.find(c => c.id === a.class_id)?.name,
        teacher: `${(a as any).users?.first_name} ${(a as any).users?.last_name}`,
        subjectId: a.subject_id,
        isClassTeacher: !a.subject_id
      })),
      marksDistribution: {
        totalRecords: marksTotal?.length || 0,
        with_scores: marksWithScores?.length || 0,
        null_scores: (marksTotal?.length || 0) - (marksWithScores?.length || 0)
      },
      dbConnection: {
        school_id: amagoroSchool.id,
        sessions: sessionIds.length,
        grade9_classes: g9ClassIds.length
      }
    }

    return NextResponse.json(report)
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
