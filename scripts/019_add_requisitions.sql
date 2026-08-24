-- ShuleTech Requisitions feature (app/requisition/*). Already applied by
-- hand against this project via the standalone shuletech-requisitions repo
-- before that feature was folded into this codebase - kept here purely so
-- the schema history in this repo is complete. Safe to re-run (every
-- statement is idempotent) if ever needed against a fresh project.
--
-- 4 known executives, real Supabase Auth accounts (email+password), RLS ON
-- for these three tables specifically - unlike the rest of this codebase's
-- anon-key/RLS-disabled convention, this feature has a small trusted user
-- base authenticated via real accounts, so RLS is the correct enforcement
-- point here. Table names checked against the existing schema - no
-- collisions.

-- One row per auth user, created automatically on signup via trigger below.
-- is_approver marks Diana as the only person who can decide requisitions.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  is_approver boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists requisitions (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id),
  type text not null check (type in ('goods', 'cash')),
  title text not null,
  description text not null default '',
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  remarks text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Optional itemized lines for goods requisitions (cash requisitions just use
-- the header's amount/description directly and have no line items).
create table if not exists requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references requisitions(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_cost numeric(12,2) not null default 0
);

alter table profiles enable row level security;
alter table requisitions enable row level security;
alter table requisition_items enable row level security;

-- Everyone in the 4-person team can see everyone's name (needed to render
-- "requested by" / "approved by" on every requisition, and to CC everyone on
-- decision emails).
create policy "profiles readable by any authenticated user" on profiles
  for select to authenticated using (true);

-- Full transparency by design: the founders explicitly want decision emails
-- to go to all four of them, so read access mirrors that - any authenticated
-- user can see any requisition.
create policy "requisitions readable by any authenticated user" on requisitions
  for select to authenticated using (true);

create policy "requisition_items readable by any authenticated user" on requisition_items
  for select to authenticated using (true);

-- Anyone can submit a requisition, only as themselves.
create policy "authenticated users can create their own requisitions" on requisitions
  for insert to authenticated with check (requester_id = auth.uid());

create policy "authenticated users can add items to their own requisitions" on requisition_items
  for insert to authenticated with check (
    exists (
      select 1 from requisitions r
      where r.id = requisition_id and r.requester_id = auth.uid() and r.status = 'pending'
    )
  );

-- A requester may edit their own requisition ONLY while it's still pending -
-- the WITH CHECK repeats status = 'pending' so this policy can never be used
-- to sneak a status change through; only the approver policy below can move
-- a requisition out of 'pending'.
create policy "requester can edit their own pending requisition" on requisitions
  for update to authenticated
  using (requester_id = auth.uid() and status = 'pending')
  with check (requester_id = auth.uid() and status = 'pending');

-- Only Diana (is_approver = true) can move a requisition to approved/rejected,
-- attach remarks, and stamp decided_by/decided_at. Not restricted to the
-- 'pending' row state so a decision can be revised if ever needed.
create policy "approver can decide any requisition" on requisitions
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_approver))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_approver));

-- Auto-create a profile row whenever a new auth user is created (the seed
-- script sets full_name/is_approver via user_metadata at creation time).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, is_approver)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'is_approver')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
