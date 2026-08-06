-- NCBA STK Push payment integration.
--
-- `schools.subscription_plan` / `subscription_expires_at` already existed but were
-- purely informational (nothing in the app read or enforced them). This migration
-- adds what's needed to actually charge schools via NCBA STK Push and auto-lock
-- access once their paid period lapses, while keeping `is_active` (already the real
-- access gate, checked in app/page.tsx) as the single source of truth for whether a
-- school can currently log in.

-- Per-school billing config: how much to charge and which phone to prompt.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_amount numeric;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_phone_number text;

-- Super-admin manual override, always wins over the automatic expiry-based lock:
--   NULL  -> automatic (locked once subscription_expires_at has passed)
--   true  -> force unlocked regardless of subscription_expires_at
--   false -> force locked regardless of subscription_expires_at
ALTER TABLE schools ADD COLUMN IF NOT EXISTS lock_override boolean;

-- One row per STK Push attempt / confirmed payment.
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  phone_number text,
  ncba_transaction_id text,
  reference_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  term_label text,
  raw_payload jsonb,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Prevents double-processing if NCBA retries the same webhook delivery.
  UNIQUE (ncba_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_school ON payment_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- Same note as scripts/004: RLS is intentionally left off to match how this app's
-- other tables are reached directly from the browser via the publishable/anon key.
-- The payment-initiating and webhook-verifying logic itself lives server-side in
-- Next.js API routes (never in client components), so this table isn't written to
-- from the browser regardless of RLS - but if your other tables DO have RLS
-- policies enabled, add an equivalent one here:
--   ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "Payment transactions accessible to app" ON payment_transactions
--     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
