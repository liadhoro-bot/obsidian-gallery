-- Adds a subscriptions table that tracks paid access to Obsidian Gallery.
-- Written by Grow (via Make) on successful payment, read by the app to
-- decide whether a signed-in user gets into the app or gets sent to /subscribe.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  phone text,
  full_name text,
  plan_name text,
  amount numeric,
  currency text not null default 'ILS',
  grow_transaction_id text,
  grow_page_code text,
  status text not null default 'inactive',
  paid_until timestamptz,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email is always normalized to lowercase (see trigger below), so a plain
-- unique constraint on the raw column is enough for Postgres upserts
-- (?on_conflict=email from the Make/HTTP scenario).
create unique index if not exists subscriptions_email_key
  on public.subscriptions (email);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- No insert/update/delete policies are defined on purpose: every write to
-- this table comes from the Make scenario or a server route using the
-- Supabase service-role key, which bypasses RLS entirely. Signed-in users
-- may only ever read their own row.
drop policy if exists "Users can view their own subscription" on public.subscriptions;

create policy "Users can view their own subscription"
  on public.subscriptions
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = email
  );

-- Normalize email casing before it ever reaches the unique index, so a
-- Make scenario that forgets to lowercase the value still upserts onto the
-- same row instead of creating a duplicate.
create or replace function public.normalize_subscription_email()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists subscriptions_normalize_email on public.subscriptions;

create trigger subscriptions_normalize_email
  before insert or update on public.subscriptions
  for each row
  execute function public.normalize_subscription_email();

-- Keep updated_at accurate on every write.
create or replace function public.touch_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.touch_subscriptions_updated_at();
