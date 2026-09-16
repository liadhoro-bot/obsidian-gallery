alter table public.contests
  add column if not exists terms_content jsonb;
