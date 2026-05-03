import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { learnerId, newClassId, newStreamId, fromStream, toStream } = await req.json()

    if (!learnerId || !newClassId) {
      return NextResponse.json(
        { error: 'Missing learnerId or newClassId' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Update learner's class and stream
    const { data: updated, error: updateError } = await supabase
      .from('learners')
      .update({
        class_id: newClassId,
        stream_id: newStreamId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', learnerId)
      .select('id, name, class_id, stream_id')

    if (updateError) throw updateError

    console.log(`[v0] Promoted learner ${learnerId} from ${fromStream} to ${toStream}`)

    return NextResponse.json({
      success: true,
      message: `Student promoted from ${fromStream} to ${toStream}`,
      learner: updated?.[0]
    })
  } catch (error) {
    console.error('[v0] Promote error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to promote learner' },
      { status: 500 }
    )
  }
}
