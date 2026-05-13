-- Create SMS logs table for audit trail
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'bulk', -- 'bulk', 'notification', 'individual'
  recipient_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_school_id ON sms_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);

-- Enable RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: schools can only see their own SMS logs
CREATE POLICY "schools_can_view_own_sms_logs"
  ON sms_logs FOR SELECT
  USING (school_id IN (SELECT id FROM schools WHERE code = CURRENT_USER));

CREATE POLICY "schools_can_insert_own_sms_logs"
  ON sms_logs FOR INSERT
  WITH CHECK (school_id IN (SELECT id FROM schools WHERE code = CURRENT_USER));
