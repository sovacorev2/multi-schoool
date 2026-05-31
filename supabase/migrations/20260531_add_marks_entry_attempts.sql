-- Add marks entry attempts tracking for Amagoro school

-- Create marks_entry_attempts table
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_session ON marks_entry_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_marks_entry_attempts_school ON marks_entry_attempts(school_id);

-- Enable RLS
ALTER TABLE marks_entry_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public access
CREATE POLICY "Allow public read access to marks_entry_attempts" ON marks_entry_attempts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert to marks_entry_attempts" ON marks_entry_attempts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update to marks_entry_attempts" ON marks_entry_attempts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to marks_entry_attempts" ON marks_entry_attempts FOR DELETE TO anon USING (true);
