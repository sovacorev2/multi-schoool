-- The webhook's "couldn't attribute this payment to a school" fallback
-- (app/api/payments/ncba/webhook/route.ts) explicitly tries to insert a
-- payment_transactions row with school_id = null so nothing silently
-- disappears - but the column was NOT NULL, so that insert has always
-- failed silently (the code never checked its result). Confirmed directly:
-- a real NCBA test notification left zero trace in this table despite
-- NCBA's own portal showing the webhook delivery as successful.

ALTER TABLE payment_transactions ALTER COLUMN school_id DROP NOT NULL;
