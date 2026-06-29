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

    console.log('[v0] Found Amagoro school:', amagoroSchool.id, amagoroSchool.name)

    // Get Grade 9 class in Amagoro
    const { data: grade9Classes } = await supabase
      .from('classes')
      .select('id, name, code')
      .eq('school_id', amagoroSchool.id)
      .ilike('name', '%grade 9%')

    console.log('[v0] Found Grade 9 classes:', grade9Classes)

    if (!grade9Classes || grade9Classes.length === 0) {
      return NextResponse.json({ error: 'No Grade 9 class found in Amagoro' }, { status: 404 })
    }

    const grade9ClassIds = grade9Classes.map(c => c.id)

    // Get all sessions for Grade 9 classes
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_id, term, year, is_active')
      .in('class_id', grade9ClassIds)
      .order('year', { ascending: false })
      .order('term', { ascending: false })

    console.log('[v0] Found sessions for Grade 9:', sessions)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ 
        school: amagoroSchool,
        classes: grade9Classes,
        message: 'No sessions found for Grade 9 in Amagoro'
      })
    }

    // Get marks for all sessions in Grade 9
    const sessionIds = sessions.map(s => s.id)
    const { data: marks } = await supabase
      .from('marks')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(100)

    console.log('[v0] Found marks for Grade 9 sessions:', marks?.length)

    // Get subjects for the classes
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name, class_id')
      .in('class_id', grade9ClassIds)

    // Get learners for the classes
    const { data: learners } = await supabase
      .from('learners')
      .select('id, name, class_id')
      .in('class_id', grade9ClassIds)
      .limit(10)

    // Count marks by subject
    const marksBySubject: Record<string, number> = {}
    const subjectsMap: Record<string, string> = {}
    subjects?.forEach(s => {
      subjectsMap[s.id] = s.name
      marksBySubject[s.id] = 0
    })

    marks?.forEach(m => {
      if (m.subject_id in marksBySubject) {
        marksBySubject[m.subject_id]++
      }
    })

    return NextResponse.json({
      school: amagoroSchool,
      classes: grade9Classes,
      sessions: sessions,
      stats: {
        totalMarks: marks?.length || 0,
        totalSubjects: subjects?.length || 0,
        totalLearnersChecked: learners?.length || 0,
        marksBySubject: Object.entries(marksBySubject).map(([subjectId, count]) => ({
          subject: subjectsMap[subjectId] || subjectId,
          markCount: count
        }))
      },
      recentMarks: marks?.slice(0, 10) || [],
      sampleLearners: learners?.map(l => ({ id: l.id, name: l.name })) || []
    })
  } catch (error: any) {
    console.error('[v0] Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
