create table if not exists public.user_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  product_updates_approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_terms_acceptances
  add column if not exists product_updates_approved_at timestamptz;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

alter table public.profiles
  add column if not exists terms_version text;

alter table public.user_terms_acceptances
  enable row level security;

create index if not exists user_terms_acceptances_user_id_idx
  on public.user_terms_acceptances(user_id);

create index if not exists user_terms_acceptances_user_version_idx
  on public.user_terms_acceptances(user_id, terms_version);

drop policy if exists "Users can insert their own terms acceptances"
  on public.user_terms_acceptances;

create policy "Users can insert their own terms acceptances"
  on public.user_terms_acceptances
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their own terms acceptances"
  on public.user_terms_acceptances;

create policy "Users can read their own terms acceptances"
  on public.user_terms_acceptances
  for select
  to authenticated
  using (auth.uid() = user_id);
