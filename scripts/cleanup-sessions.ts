// Script to clean up auto-created sessions
// Run this manually to remove all sessions from the database

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanupSessions() {
  console.log('[v0] Cleaning up auto-created sessions...')

  try {
    // Delete ALL sessions - we want a clean slate
    // Teachers will create sessions manually when entering marks
    const { data, error } = await supabase
      .from('sessions')
      .delete()
      .neq('id', '') // This deletes everything

    if (error) {
      console.error('[v0] Error deleting sessions:', error)
      return
    }

    console.log('[v0] Successfully deleted all sessions')
    console.log('[v0] Sessions will be created manually by teachers going forward')
  } catch (error) {
    console.error('[v0] Cleanup failed:', error)
  }
}

cleanupSessions()
