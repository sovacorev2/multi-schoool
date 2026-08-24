-- Wires up the two requisition notification webhooks directly via SQL,
-- instead of the Database Webhooks dashboard UI - "Database Webhooks" in
-- Supabase is just a convenience wrapper around a plain Postgres trigger
-- calling supabase_functions.http_request(), which is exactly what this
-- creates. Once run, both hooks show up normally in
-- Database -> Webhooks in the dashboard, and can be edited/deleted there
-- like any hook created through the UI.
--
-- Replace the secret below if you ever rotate REQUISITIONS_WEBHOOK_SECRET
-- (must match the Vercel env var of the same name exactly).

drop trigger if exists "requisition_submitted_webhook" on "public"."requisitions";
create trigger "requisition_submitted_webhook"
after insert on "public"."requisitions"
for each row
execute function "supabase_functions"."http_request"(
  'https://exams.shuletechsolutions.co.ke/requisition/api/webhooks/requisition-submitted',
  'POST',
  '{"Content-type":"application/json","x-webhook-secret":"39d85c08e6e5f5b30e8969bba6434d152173c1877ed9c6a700ec80a48acb17ef"}',
  '{}',
  '5000'
);

drop trigger if exists "requisition_decided_webhook" on "public"."requisitions";
create trigger "requisition_decided_webhook"
after update on "public"."requisitions"
for each row
execute function "supabase_functions"."http_request"(
  'https://exams.shuletechsolutions.co.ke/requisition/api/webhooks/requisition-decided',
  'POST',
  '{"Content-type":"application/json","x-webhook-secret":"39d85c08e6e5f5b30e8969bba6434d152173c1877ed9c6a700ec80a48acb17ef"}',
  '{}',
  '5000'
);
