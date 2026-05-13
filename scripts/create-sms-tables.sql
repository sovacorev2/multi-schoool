-- SMS Management Tables for Shuletech Exam System

-- SMS Bundles (pricing packages configured by super admin)
CREATE TABLE IF NOT EXISTS sms_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_count INTEGER NOT NULL,
  price_ksh DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- School SMS Credits (tracks balance per school)
CREATE TABLE IF NOT EXISTS school_sms_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  available_credits INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(school_id)
);

-- SMS Transactions (purchase requests from schools)
CREATE TABLE IF NOT EXISTS sms_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES sms_bundles(id),
  sms_count INTEGER NOT NULL,
  price_ksh DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SMS Usage Logs (track every SMS sent)
CREATE TABLE IF NOT EXISTS sms_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  recipient_count INTEGER NOT NULL,
  sms_deducted INTEGER NOT NULL,
  message_preview TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_credits_school ON school_sms_credits(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_school ON sms_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_status ON sms_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sms_usage_school ON sms_usage_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_date ON sms_usage_logs(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_sms_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_bundles (public read, admin write)
CREATE POLICY "Anyone can view SMS bundles" ON sms_bundles
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage SMS bundles" ON sms_bundles
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated');

-- RLS Policies for school_sms_credits (schools can view their own)
CREATE POLICY "Schools can view their own credits" ON school_sms_credits
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM school_admins 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all credits" ON school_sms_credits
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated');

-- RLS Policies for sms_transactions (schools can view their own)
CREATE POLICY "Schools can view their own transactions" ON sms_transactions
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM school_admins 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Schools can create transaction requests" ON sms_transactions
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM school_admins 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for sms_usage_logs (schools can view their own)
CREATE POLICY "Schools can view their own usage" ON sms_usage_logs
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM school_admins 
      WHERE user_id = auth.uid()
    )
  );

-- Insert default SMS bundles if they don't exist
INSERT INTO sms_bundles (sms_count, price_ksh, description)
VALUES 
  (100, 500, '100 SMS Package'),
  (500, 2000, '500 SMS Package'),
  (1000, 3500, '1000 SMS Package'),
  (5000, 15000, '5000 SMS Package')
ON CONFLICT DO NOTHING;
