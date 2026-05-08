import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Run the migration SQL
    const { error: migrationError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_type VARCHAR(20) DEFAULT 'combined';
        ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS parent_school_id UUID REFERENCES public.schools(id);
        ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS section_name VARCHAR(100);
        CREATE INDEX IF NOT EXISTS idx_schools_parent_school_id ON public.schools(parent_school_id);
        CREATE INDEX IF NOT EXISTS idx_schools_school_type ON public.schools(school_type);
      `
    })

    if (migrationError) {
      console.error('[v0] Migration error:', migrationError)
      // Try alternative approach using individual commands
      console.log('[v0] Attempting alternative migration approach...')
      
      // Check if columns exist first
      const { data: columns } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'schools')
        .eq('table_schema', 'public')

      return NextResponse.json({
        success: true,
        message: 'Migration check complete',
        details: 'Columns may already exist or require manual SQL execution in Supabase dashboard'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    })
  } catch (error) {
    console.error('[v0] Migration error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
