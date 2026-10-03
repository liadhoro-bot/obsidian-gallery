-- Pricing v2: one 14-day free trial per account, ever.
-- Rows are written only by the server (service role) through
-- /api/trial/start with ON CONFLICT (user_id) DO NOTHING.
create table public.trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  terms_version text,
  created_at timestamptz not null default now()
);

create index trials_email_lower_idx on public.trials (lower(email));

alter table public.trials enable row level security;

create policy "users read own trial" on public.trials
  for select using (auth.uid() = user_id);

-- no insert/update policies: writes go through the service-role client only
