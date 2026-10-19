-- Monthly (₪10/month) recurring billing through Grow's direct debit.
-- Founder's Pass and other one-time rows keep working unchanged: the new
-- columns are all nullable or defaulted, and access is still decided only
-- by paid_until.

alter table public.subscriptions
  add column if not exists billing_type text,
  add column if not exists grow_transaction_token text,
  add column if not exists grow_asmachta text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  -- How the cancellation reached Grow: 'synced' (Grow API accepted it),
  -- 'manual' (admin was emailed to stop it in Grow's dashboard), 'failed'.
  add column if not exists grow_cancel_status text;

-- One row per Grow notification we processed. Grow retries a notification
-- until it is approved, so the unique transaction id makes processing
-- idempotent; the raw payload is kept for support and debugging.
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  grow_transaction_id text not null,
  email text not null,
  plan_name text,
  amount numeric,
  paid_until timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists subscription_payments_grow_transaction_id_key
  on public.subscription_payments (grow_transaction_id);

create index if not exists subscription_payments_email_idx
  on public.subscription_payments (lower(email));

-- Service role only: no policies.
alter table public.subscription_payments enable row level security;
