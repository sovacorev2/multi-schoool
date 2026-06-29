import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get Amagoro school
    const { data: amagoroSchool } = await supabase
      .from('schools')
      .select('id, name')
      .ilike('name', '%amagoro%')
      .single()

    if (!amagoroSchool) {
      return NextResponse.json({ error: 'Amagoro school not found' }, { status: 404 })
    }

    // Get Grade 9 classes
    const { data: grade9Classes } = await supabase
      .from('classes')
      .select('id, name, code')
      .eq('school_id', amagoroSchool.id)
      .ilike('name', '%grade 9%')

    if (!grade9Classes || grade9Classes.length === 0) {
      return NextResponse.json({ error: 'No Grade 9 classes found' }, { status: 404 })
    }

    const grade9ClassIds = grade9Classes.map(c => c.id)

    // Get all sessions for Grade 9
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_id, term, year')
      .in('class_id', grade9ClassIds)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No sessions found' }, { status: 404 })
    }

    const sessionIds = sessions.map(s => s.id)

    // Get all marks for these sessions
    const { data: marks } = await supabase
      .from('marks')
      .select('*')
      .in('session_id', sessionIds)

    // Get all valid subject IDs for Grade 9 classes
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name, class_id')
      .in('class_id', grade9ClassIds)

    const validSubjectIds = new Set(subjects?.map(s => s.id) || [])
    const subjectNames: Record<string, string> = {}
    subjects?.forEach(s => {
      subjectNames[s.id] = s.name
    })

    // Find orphaned marks (marks with subject_id not in subjects table)
    const orphanedMarks = (marks || []).filter(m => !validSubjectIds.has(m.subject_id))
    
    // Group orphaned marks by subject_id
    const orphansBySubjectId: Record<string, any[]> = {}
    orphanedMarks.forEach(m => {
      if (!orphansBySubjectId[m.subject_id]) {
        orphansBySubjectId[m.subject_id] = []
      }
      orphansBySubjectId[m.subject_id].push({
        learner_id: m.learner_id,
        session_id: m.session_id,
        score: m.score,
        created_at: m.created_at
      })
    })

    // Check if the orphaned subject_ids exist anywhere in subjects table
    const orphanedSubjectIds = Object.keys(orphansBySubjectId)
    const { data: orphanedSubjectsInfo } = await supabase
      .from('subjects')
      .select('id, name, class_id, classes(name)')
      .in('id', orphanedSubjectIds)

    return NextResponse.json({
      school: amagoroSchool,
      grade9Classes: grade9Classes,
      stats: {
        totalSessions: sessions.length,
        totalMarks: marks?.length || 0,
        totalValidSubjects: subjects?.length || 0,
        totalOrphanedMarks: orphanedMarks.length,
        orphanedSubjectCount: Object.keys(orphansBySubjectId).length
      },
      orphanedSubjects: orphanedSubjectsInfo?.map(s => ({
        id: s.id,
        name: s.name,
        classId: s.class_id,
        className: (s as any).classes?.name,
        markCount: orphansBySubjectId[s.id]?.length || 0
      })),
      sampleOrphanedMarks: Object.entries(orphansBySubjectId).slice(0, 3).map(([subjId, marks]) => ({
        subjectId: subjId,
        markCount: marks.length,
        sampleMarks: marks.slice(0, 3)
      })),
      validSubjects: subjects?.map(s => ({
        id: s.id,
        name: s.name
      }))
    })
  } catch (error: any) {
    console.error('[v0] Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
