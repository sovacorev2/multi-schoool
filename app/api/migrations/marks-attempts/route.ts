import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Helper function to execute raw SQL via Supabase admin API
async function executeSQL(sql: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const response = await fetch(`${url}/rest/v1/rpc/postgres_query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    })

    return response
  } catch (error) {
    console.error('[v0] SQL execution error:', error)
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[v0] Starting marks_entry_attempts table setup...')

    // Use Supabase service role to create the table
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    )

    // Try to create a simple test record to verify table exists
    const testId = `test-${Date.now()}`
    
    // Insert a test record (this will create the table implicitly if we use the right approach)
    // Actually, let's just try to fetch - if it errors with table not found, we know we need to create
    const { error: checkError } = await supabase
      .from('marks_entry_attempts')
      .select('id')
      .limit(1)

    if (checkError?.code === 'PGRST09' || checkError?.code === 'PGRST116') {
      // Table doesn't exist - we need to create it via the Postgres API
      console.log('[v0] Table does not exist, attempting to create...')
      
      // Since Supabase doesn't provide direct SQL execution, we'll create the table
      // by creating it through the schema API
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.marks_entry_attempts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
          school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
          attempts_remaining integer DEFAULT 3 NOT NULL,
          is_locked boolean DEFAULT false NOT NULL,
          locked_at timestamptz,
          locked_by text,
          unlocked_at timestamptz,
          unlocked_by text,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL,
          UNIQUE(session_id, school_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_session ON public.marks_entry_attempts(session_id);
        CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_school ON public.marks_entry_attempts(school_id);
        
        ALTER TABLE public.marks_entry_attempts ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Allow public read marks_entry_attempts" ON public.marks_entry_attempts;
        DROP POLICY IF EXISTS "Allow public insert marks_entry_attempts" ON public.marks_entry_attempts;
        DROP POLICY IF EXISTS "Allow public update marks_entry_attempts" ON public.marks_entry_attempts;
        
        CREATE POLICY "Allow public read marks_entry_attempts" ON public.marks_entry_attempts 
          FOR SELECT TO anon, authenticated USING (true);
        CREATE POLICY "Allow public insert marks_entry_attempts" ON public.marks_entry_attempts 
          FOR INSERT TO anon, authenticated WITH CHECK (true);
        CREATE POLICY "Allow public update marks_entry_attempts" ON public.marks_entry_attempts 
          FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
      `

      // For now, return that we need manual setup
      return NextResponse.json({
        success: false,
        message: 'Table needs to be created via Supabase dashboard or CLI',
        details: 'Please run the SQL migration manually or use Supabase CLI: supabase db push',
        sql: createTableSQL
      }, { status: 400 })
    }

    console.log('[v0] Table is ready')
    return NextResponse.json({
      success: true,
      message: 'marks_entry_attempts table is ready'
    })
  } catch (error) {
    console.error('[v0] Migration error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
