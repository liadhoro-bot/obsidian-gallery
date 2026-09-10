alter table public.contests
  add column if not exists sponsor_name text,
  add column if not exists sponsor_logo_url text,
  add column if not exists prize_first_place text,
  add column if not exists prize_second_place text,
  add column if not exists how_it_works jsonb,
  add column if not exists results_target_at timestamptz;
