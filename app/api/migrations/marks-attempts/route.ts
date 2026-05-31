import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create marks_entry_attempts table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS marks_entry_attempts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          attempts_remaining integer DEFAULT 3,
          is_locked boolean DEFAULT false,
          locked_at timestamptz,
          locked_by text,
          unlocked_at timestamptz,
          unlocked_by text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          UNIQUE(session_id, school_id)
        );

        CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_session ON marks_entry_attempts(session_id);
        CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_school ON marks_entry_attempts(school_id);

        ALTER TABLE marks_entry_attempts ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Allow public read access to marks_entry_attempts" ON marks_entry_attempts;
        DROP POLICY IF EXISTS "Allow public insert to marks_entry_attempts" ON marks_entry_attempts;
        DROP POLICY IF EXISTS "Allow public update to marks_entry_attempts" ON marks_entry_attempts;
        DROP POLICY IF EXISTS "Allow public delete to marks_entry_attempts" ON marks_entry_attempts;

        CREATE POLICY "Allow public read access to marks_entry_attempts" ON marks_entry_attempts FOR SELECT TO anon USING (true);
        CREATE POLICY "Allow public insert to marks_entry_attempts" ON marks_entry_attempts FOR INSERT TO anon WITH CHECK (true);
        CREATE POLICY "Allow public update to marks_entry_attempts" ON marks_entry_attempts FOR UPDATE TO anon USING (true) WITH CHECK (true);
        CREATE POLICY "Allow public delete to marks_entry_attempts" ON marks_entry_attempts FOR DELETE TO anon USING (true);
      `
    })

    if (createTableError) {
      console.error('[v0] Error creating table:', createTableError)
      // Continue anyway - table might already exist
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      error: createTableError
    })
  } catch (error) {
    console.error('[v0] Migration error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
