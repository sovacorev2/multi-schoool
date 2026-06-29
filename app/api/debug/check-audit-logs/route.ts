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

    // Get recent audit logs for Amagoro (last 100)
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', amagoroSchool.id)
      .ilike('action', '%mark%')
      .order('created_at', { ascending: false })
      .limit(100)

    // Get all event types
    const eventTypes = new Set<string>()
    const actionsByType: Record<string, number> = {}
    
    auditLogs?.forEach(log => {
      eventTypes.add(log.action)
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1
    })

    // Get the 10 most recent entries related to marks
    const recentMarkLogs = auditLogs?.slice(0, 10).map(log => ({
      id: log.id,
      action: log.action,
      actor: log.actor,
      details: log.details,
      createdAt: log.created_at,
      changes: log.changes
    }))

    return NextResponse.json({
      school: amagoroSchool,
      stats: {
        totalMarkRelatedLogs: auditLogs?.length || 0,
        uniqueActions: Array.from(eventTypes),
        actionCounts: actionsByType
      },
      recentLogs: recentMarkLogs
    })
  } catch (error: any) {
    console.error('[v0] Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
