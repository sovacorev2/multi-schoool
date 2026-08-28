-- Lets a requisition specify how the money should actually be disbursed -
-- bank transfer, mobile money (M-Pesa), or cash - so the approver has
-- everything needed to actually pay it without a separate conversation.

ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('bank', 'mobile_money', 'cash'));
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS payment_details jsonb;
