-- SMS Bundles (defined by Super Admin)
create table sms_bundles (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- "100 SMS", "500 SMS", "1000 SMS"
  sms_count integer not null,
  price_ksh decimal not null, -- Price in KES
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- School SMS Credits (per-school balance)
create table school_sms_credits (
  id uuid default gen_random_uuid() primary key,
  school_id uuid not null references schools(id) on delete cascade,
  balance integer default 0, -- Current SMS balance
  total_purchased integer default 0, -- Total SMS ever purchased
  total_used integer default 0, -- Total SMS ever used
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id)
);

-- SMS Purchase Transactions (when schools buy bundles)
create table sms_transactions (
  id uuid default gen_random_uuid() primary key,
  school_id uuid not null references schools(id) on delete cascade,
  bundle_id uuid not null references sms_bundles(id),
  sms_count integer not null,
  price_ksh decimal not null,
  status text default 'pending', -- pending, completed, failed, cancelled
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- SMS Usage Logs (track each SMS sent)
create table sms_usage_logs (
  id uuid default gen_random_uuid() primary key,
  school_id uuid not null references schools(id) on delete cascade,
  recipient_count integer not null, -- Number of recipients
  sms_count integer not null, -- Total SMS sent (could be > 1 per recipient if message is long)
  message_preview text, -- First 100 chars
  status text default 'sent', -- sent, failed, pending
  twilio_sid text, -- or Africa's Talking API response ID
  sent_at timestamp default now(),
  created_at timestamp default now()
);

-- Enable RLS
alter table sms_bundles enable row level security;
alter table school_sms_credits enable row level security;
alter table sms_transactions enable row level security;
alter table sms_usage_logs enable row level security;

-- RLS Policies for Super Admin (can see all)
create policy "Super admin can see all sms bundles"
  on sms_bundles for select
  using (auth.jwt() ->> 'role' = 'super_admin');

create policy "Super admin can manage sms bundles"
  on sms_bundles for all
  using (auth.jwt() ->> 'role' = 'super_admin');

-- RLS Policies for Schools (can only see their own data)
create policy "Schools can see their own SMS credits"
  on school_sms_credits for select
  using (
    school_id in (
      select id from schools where admin_id = auth.uid()
    )
  );

create policy "Schools can see their own SMS transactions"
  on sms_transactions for select
  using (
    school_id in (
      select id from schools where admin_id = auth.uid()
    )
  );

create policy "Schools can create SMS transactions"
  on sms_transactions for insert
  with check (
    school_id in (
      select id from schools where admin_id = auth.uid()
    )
  );

create policy "Schools can see their own SMS logs"
  on sms_usage_logs for select
  using (
    school_id in (
      select id from schools where admin_id = auth.uid()
    )
  );

-- Super admin can see all
create policy "Super admin can see all SMS credits"
  on school_sms_credits for select
  using (auth.jwt() ->> 'role' = 'super_admin');

create policy "Super admin can see all SMS transactions"
  on sms_transactions for select
  using (auth.jwt() ->> 'role' = 'super_admin');

create policy "Super admin can update SMS transactions"
  on sms_transactions for update
  using (auth.jwt() ->> 'role' = 'super_admin');

create policy "Super admin can see all SMS logs"
  on sms_usage_logs for select
  using (auth.jwt() ->> 'role' = 'super_admin');
