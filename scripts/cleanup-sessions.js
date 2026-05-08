// Script to clean up auto-created sessions
// Run this manually to remove all sessions from the database

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function cleanupSessions() {
  console.log('[v0] Cleaning up auto-created sessions...')

  try {
    // Delete audit logs that reference sessions first
    console.log('[v0] Deleting audit logs...')
    const { error: auditError } = await supabase
      .from('audit_logs')
      .delete()
      .not('session_id', 'is', null)

    if (auditError) {
      console.error('[v0] Error deleting audit logs:', auditError)
      return
    }

    console.log('[v0] Audit logs deleted')

    // Get all sessions first
    const { data: sessions, error: fetchError } = await supabase
      .from('sessions')
      .select('id')

    if (fetchError) {
      console.error('[v0] Error fetching sessions:', fetchError)
      return
    }

    console.log(`[v0] Found ${sessions?.length || 0} sessions to delete`)

    if (!sessions || sessions.length === 0) {
      console.log('[v0] No sessions to delete - database is clean!')
      return
    }

    // Delete all sessions
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .not('id', 'is', null)

    if (deleteError) {
      console.error('[v0] Error deleting sessions:', deleteError)
      return
    }

    console.log('[v0] Successfully deleted all sessions')
    console.log('[v0] Sessions will be created manually by teachers going forward')
  } catch (error) {
    console.error('[v0] Cleanup failed:', error)
  }
}

cleanupSessions()
