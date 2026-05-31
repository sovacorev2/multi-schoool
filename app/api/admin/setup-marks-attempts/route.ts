import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    console.log('[v0] Setting up marks_entry_attempts table...')

    // Create admin Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false }
      }
    )

    // Try to create the table - if it exists, this will silently fail which is fine
    const { error: createError } = await supabase
      .from('marks_entry_attempts')
      .insert({
        id: '00000000-0000-0000-0000-000000000000',
        session_id: '00000000-0000-0000-0000-000000000000',
        school_id: '00000000-0000-0000-0000-000000000000',
        attempts_remaining: 3,
        is_locked: false
      })
      .select()

    // The insert will fail but if it's a constraint error or relation exists error, that's actually success
    // What we really need is to just check if the table can be queried

    // Give the database a moment to process
    await new Promise(resolve => setTimeout(resolve, 500))

    // Now try to verify the table exists by doing a simple count
    let retries = 0
    let tableExists = false

    while (retries < 3) {
      const { data: countData, error: countError } = await supabase
        .from('marks_entry_attempts')
        .select('id')
        .limit(1)

      if (!countError) {
        tableExists = true
        console.log('[v0] Table verified successfully')
        break
      }

      console.log(`[v0] Attempt ${retries + 1}: ${countError?.message}`)
      retries++

      if (retries < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (tableExists) {
      return NextResponse.json({
        success: true,
        message: 'marks_entry_attempts table is ready'
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Table setup failed. Please create it manually via Supabase dashboard.',
          sql: `
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
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[v0] Setup error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
