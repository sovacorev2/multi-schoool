-- Resource Centre file uploads (exams, marking schemes, schemes of work,
-- CBC projects) were going through our own serverless API route as base64,
-- the same proven pattern used for school logos. Logos are tiny; real exam
-- PDFs are not - Vercel's serverless functions have a hard ~4.5MB request
-- body ceiling that cannot be raised by any app-level config, so any file
-- near or over that size gets rejected by the platform before our route
-- even runs, and the client shows a raw HTML error page it can't parse as
-- JSON ("Failed to save... Unexpected token 'R', 'Request En'... is not
-- valid JSON").
--
-- Fix: upload straight from the browser to Supabase Storage (bypasses our
-- serverless function and its body-size ceiling entirely), then store the
-- file's metadata + public URL in the `resources` table same as before.
-- Matches this app's existing anon-key-direct-write architecture - no
-- Supabase Auth session, so storage.objects needs explicit permissive
-- policies for this bucket instead of relying on auth.uid()-based ones.

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', true, 26214400) -- 25MB
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists "resources_public_read" on storage.objects;
create policy "resources_public_read" on storage.objects
  for select using (bucket_id = 'resources');

drop policy if exists "resources_public_insert" on storage.objects;
create policy "resources_public_insert" on storage.objects
  for insert with check (bucket_id = 'resources');

drop policy if exists "resources_public_delete" on storage.objects;
create policy "resources_public_delete" on storage.objects
  for delete using (bucket_id = 'resources');

-- Storage object path, kept alongside the public URL already stored in
-- file_data_url, so a delete can also remove the underlying file instead of
-- leaving it orphaned in the bucket. Null for resources uploaded before this
-- change (their file_data_url is still a base64 data: URL and works as-is).
alter table resources add column if not exists storage_path text;
